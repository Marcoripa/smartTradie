import { hardwareCheckService, ExecutionTier } from './HardwareCheckService';
export { ExecutionTier };
import {
  sqliteQueueService,
  NoteQueueRecord,
  ProjectResolutionStatus,
} from './SQLiteQueueService';
import { localWhisperService } from './LocalWhisperService';
import { locationService, LocationData } from './LocationService';
import { firestoreService } from './FirestoreService';
import {
  enableAudioDuckFocus,
  releaseAudioFocus,
  startAudioRecording,
  stopAudioRecording,
  cancelAudioRecording,
} from './audio';
import { speakPrompt, stopSpeech } from './tts';
import { VADTracker } from './vad';
import { firebaseSyncManager } from './FirebaseSyncManager';
import { wakeWordService } from './WakeWordService';
import { WorkflowTemplate, WorkflowStepDefinition } from '../types/workflow';
import { DEFAULT_WORKFLOW_TEMPLATES } from './WorkflowTemplates';
import { appConfigService } from '../config/appConfig';

export enum DriveSessionStep {
  IDLE = 'IDLE',
  HARDWARE_CHECK = 'HARDWARE_CHECK',
  
  // Phase 1: Universal Project & Location Selection (Mandatory First Step)
  Q1_PROJECT_TYPE_PROMPT = 'Q1_PROJECT_TYPE_PROMPT',
  Q1_PROJECT_TYPE_RECORDING = 'Q1_PROJECT_TYPE_RECORDING',
  Q1_PROJECT_TYPE_REASONING = 'Q1_PROJECT_TYPE_REASONING',
  
  Q1A_NEW_NAME_RECORDING = 'Q1A_NEW_NAME_RECORDING',
  Q1B_EXISTING_NAME_RECORDING = 'Q1B_EXISTING_NAME_RECORDING',
  Q2_LOC_VERIFY_RECORDING = 'Q2_LOC_VERIFY_RECORDING',
  Q2A_ADDRESS_RECORDING = 'Q2A_ADDRESS_RECORDING',

  // Phase 2: Universal Intent Router ("How can I help you today?")
  UNIVERSAL_HELP_ROUTER_PROMPT = 'UNIVERSAL_HELP_ROUTER_PROMPT',
  UNIVERSAL_HELP_ROUTER_RECORDING = 'UNIVERSAL_HELP_ROUTER_RECORDING',
  UNIVERSAL_HELP_ROUTER_REASONING = 'UNIVERSAL_HELP_ROUTER_REASONING',

  // Phase 3: Dynamic Workflow Specific Steps
  WORKFLOW_STEP_PROMPT = 'WORKFLOW_STEP_PROMPT',
  WORKFLOW_STEP_RECORDING = 'WORKFLOW_STEP_RECORDING',
  WORKFLOW_STEP_REASONING = 'WORKFLOW_STEP_REASONING',

  // Hands-Free Cancel Confirmation Sub-flow
  CONFIRM_CANCEL_PROMPT = 'CONFIRM_CANCEL_PROMPT',
  CONFIRM_CANCEL_RECORDING = 'CONFIRM_CANCEL_RECORDING',
  CONFIRM_CANCEL_REASONING = 'CONFIRM_CANCEL_REASONING',

  // Phase 4: Save & Completion
  SAVING_QUEUE = 'SAVING_QUEUE',
  SESSION_COMPLETE = 'SESSION_COMPLETE',
}

export interface SessionState {
  currentStep: DriveSessionStep;
  executionTier: ExecutionTier;
  isSpeaking: boolean;
  isRecording: boolean;
  meterLevel: number;
  speechDetected: boolean;
  silenceMs: number;
  
  // Active dynamic workflow
  activeWorkflow: WorkflowTemplate;
  currentStepIndex: number;
  currentStepDefinition?: WorkflowStepDefinition;
  totalSteps: number;

  // Project & Location metadata
  isNewProject: boolean;
  projectStatus: ProjectResolutionStatus;
  matchedProjectId?: string;
  projectNameText?: string;
  locationData?: LocationData;

  // Accumulated dynamic step extractions
  workflowResults: Record<string, any>;
  rawTranscriptText?: string;
  actionItemsText?: string;
  statusMessage: string;
}

/**
 * On-Device Llama 3.2 1B / Qwen 2.5 1.5B Local Engine Wrapper
 */
class LocalLlamaEngine {
  private isLoaded = false;
  private llamaContext: any = null;
  private modelPath = 'assets/models/llama-3.2-1b-instruct-q4_k_m.gguf';

  public async initializeModel(customPath?: string): Promise<boolean> {
    if (customPath) this.modelPath = customPath;
    console.log(`[LocalLlamaEngine] Initializing on-device GGUF model: ${this.modelPath}`);

    try {
      let initLlama: any = null;
      try {
        const llamaModule = require('llama.rn');
        initLlama = llamaModule?.initLlama;
      } catch {}

      if (initLlama) {
        this.llamaContext = await initLlama({
          model: this.modelPath,
          n_ctx: 2048,
          n_gpu_layers: 0,
        });
        this.isLoaded = true;
        console.log('[LocalLlamaEngine] On-device Llama GGUF context loaded successfully!');
        return true;
      }
    } catch (error) {
      console.warn('[LocalLlamaEngine] Native GGUF runtime notice:', error);
    }

    this.isLoaded = false;
    return false;
  }

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  public async generateLocalCompletion(prompt: string, fallbackText: string): Promise<string> {
    if (this.isLoaded && this.llamaContext) {
      try {
        console.log('[LocalLlamaEngine] Running Llama local inference prompt:', prompt.slice(0, 80));
        const response = await this.llamaContext.completion({
          prompt: `<|system|>\nYou are SmartTradie AI running 100% locally on-device for an Australian regional driver.\n<|user|>\n${prompt}\n<|assistant|>`,
          max_tokens: 150,
          temperature: 0.1,
        });
        if (response && response.text) {
          const cleaned = response.text.trim();
          console.log('[LocalLlamaEngine] Llama reasoning result:', cleaned);
          return cleaned;
        }
      } catch (e) {
        console.warn('[LocalLlamaEngine] Inference error, falling back:', e);
      }
    }
    return fallbackText;
  }

  /**
   * Classifies user affirmation (YES vs NO) for conversational branching
   */
  public async classifyYesNo(spokenText: string, fallbackYes = true): Promise<boolean> {
    const textLower = spokenText.toLowerCase().trim();
    if (
      textLower.includes('yes') ||
      textLower.includes('yeah') ||
      textLower.includes('correct') ||
      textLower.includes('yep') ||
      textLower.includes('sure') ||
      textLower.includes('right') ||
      textLower.includes('cancel it') ||
      textLower.includes('stop it') ||
      textLower.includes('confirm')
    ) {
      return true;
    }
    if (
      textLower.includes('no') ||
      textLower.includes('nah') ||
      textLower.includes('wrong') ||
      textLower.includes('nope') ||
      textLower.includes('continue') ||
      textLower.includes('keep going') ||
      textLower.includes('resume') ||
      textLower.includes('different') ||
      textLower.includes('manual')
    ) {
      return false;
    }

    if (this.isLoaded && this.llamaContext) {
      const answer = await this.generateLocalCompletion(
        `Does this statement indicate "YES" or "NO"? Statement: "${spokenText}". Answer ONLY with "YES" or "NO".`,
        fallbackYes ? 'YES' : 'NO'
      );
      return answer.toUpperCase().includes('YES');
    }

    return fallbackYes;
  }

  /**
   * Classifies user response to "How can I help you today?" into matching workflow
   */
  public classifyWorkflowIntent(spokenText: string, workflows: WorkflowTemplate[]): WorkflowTemplate {
    const lower = spokenText.toLowerCase().trim();

    // 1. Direct keyword match
    for (const wf of workflows) {
      if (wf.triggerPhrases.some((phrase) => lower.includes(phrase.toLowerCase()))) {
        console.log(`[Llama Intent] Matched workflow "${wf.name}" via trigger phrase in "${spokenText}"`);
        return wf;
      }
    }

    // 2. Specialized keyword heuristics
    if (lower.includes('clock') || lower.includes('hour') || lower.includes('time') || lower.includes('shift') || lower.includes('start work') || lower.includes('finish work')) {
      const match = workflows.find((w) => w.id === 'workflow_job_clocking');
      if (match) return match;
    }

    if (lower.includes('material') || lower.includes('part') || lower.includes('stock') || lower.includes('deduct') || lower.includes('inventory') || lower.includes('pipe') || lower.includes('cement')) {
      const match = workflows.find((w) => w.id === 'workflow_materials_used');
      if (match) return match;
    }

    if (lower.includes('safety') || lower.includes('hazard') || lower.includes('jsa') || lower.includes('ppe') || lower.includes('swms') || lower.includes('risk')) {
      const match = workflows.find((w) => w.id === 'workflow_safety_audit');
      if (match) return match;
    }

    // Default fallback to Field Note
    const defaultWf = workflows.find((w) => w.id === 'workflow_voice_note') || workflows[0];
    console.log(`[Llama Intent] Defaulting to "${defaultWf.name}" for spoken phrase: "${spokenText}"`);
    return defaultWf;
  }
}

export const localLlamaEngine = new LocalLlamaEngine();

/**
 * Cleans conversational filler words from spoken project names without adding extra hallucinated words
 */
export function cleanSpokenProjectName(rawText: string): string {
  if (!rawText) return 'New Project';
  let text = rawText.trim();

  // Strip leading affirmative/filler words e.g. "yes", "yeah", "it's called", "name is"
  const prefixPatterns = [
    /^(yes|yeah|yep|no|nah)\s*[,;.]*\s*/i,
    /^(it's called|it is called|its called|it's|its|the project is|the name is|name is|project name is|call it|project is|named|it would be|let's call it)\s+/i,
  ];

  for (const pattern of prefixPatterns) {
    text = text.replace(pattern, '').trim();
  }

  // Strip trailing punctuation
  text = text.replace(/[.,;:!?]+$/, '').trim();

  // Capitalize words
  const capitalized = text
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return capitalized || 'New Project';
}

export class VoiceStateMachine {
  private state: SessionState;
  private vadTracker: VADTracker;
  private listeners: Set<(state: SessionState) => void> = new Set();

  private activeAudioUri: string | null = null;
  private contentAudioUri: string | null = null;

  // Timeout & Retry management (8.5s silence waiting for voice input)
  private currentPromptText = "Is this for a new project?";
  private stepRetryCount = 0;
  private noSpeechTimeoutTimer: any = null;
  private readonly NO_SPEECH_TIMEOUT_MS = 8500;

  // Cancel confirmation state tracking
  private previousStepBeforeCancel: DriveSessionStep | null = null;
  private previousPromptBeforeCancel: string = '';

  constructor() {
    this.vadTracker = new VADTracker();
    this.state = this.getInitialState();
  }

  private getInitialState(): SessionState {
    const defaultWorkflow = DEFAULT_WORKFLOW_TEMPLATES[0];
    return {
      currentStep: DriveSessionStep.IDLE,
      executionTier: 'LOCAL_AI',
      isSpeaking: false,
      isRecording: false,
      meterLevel: -160,
      speechDetected: false,
      silenceMs: 0,
      activeWorkflow: defaultWorkflow,
      currentStepIndex: 0,
      currentStepDefinition: defaultWorkflow.steps[0],
      totalSteps: defaultWorkflow.steps.length,
      isNewProject: true,
      projectStatus: 'NEW_PROJECT',
      workflowResults: {},
      statusMessage: 'Ready. Say "Hey Mark" or tap to start.',
    };
  }

  public subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<SessionState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }

  public getState(): SessionState {
    return this.state;
  }

  public setActiveWorkflow(templateOrId: WorkflowTemplate | string): void {
    let template: WorkflowTemplate | undefined;
    if (typeof templateOrId === 'string') {
      template = DEFAULT_WORKFLOW_TEMPLATES.find((t) => t.id === templateOrId);
    } else {
      template = templateOrId;
    }

    if (template) {
      this.setState({
        activeWorkflow: template,
        currentStepIndex: 0,
        currentStepDefinition: template.steps[0],
        totalSteps: template.steps.length,
      });
      console.log(`[VoiceStateMachine] Active workflow set to: ${template.name}`);
    }
  }

  /**
   * Check if spoken text contains a stop/cancel trigger keyword
   */
  public isStopKeyword(spokenText: string): boolean {
    const lower = spokenText.toLowerCase().trim();
    if (
      lower === 'stop' ||
      lower === 'cancel' ||
      lower === 'abort' ||
      lower === 'quit' ||
      lower === 'exit' ||
      lower === 'stop recording' ||
      lower === 'cancel recording' ||
      lower.includes('stop session') ||
      lower.includes('cancel session') ||
      lower.includes('cancel note') ||
      lower.includes('stop note') ||
      lower.includes('abort session') ||
      lower.includes('stop it') ||
      lower.includes('cancel it')
    ) {
      return true;
    }
    return false;
  }

  private startNoSpeechTimeout(step: DriveSessionStep): void {
    this.clearNoSpeechTimeout();
    this.noSpeechTimeoutTimer = setTimeout(() => {
      this.handleNoSpeechTimeout(step);
    }, this.NO_SPEECH_TIMEOUT_MS);
  }

  private clearNoSpeechTimeout(): void {
    if (this.noSpeechTimeoutTimer) {
      clearTimeout(this.noSpeechTimeoutTimer);
      this.noSpeechTimeoutTimer = null;
    }
  }

  private async handleNoSpeechTimeout(step: DriveSessionStep): Promise<void> {
    this.clearNoSpeechTimeout();
    this.stepRetryCount++;
    console.log(`[VoiceStateMachine] No-speech timeout fired for step ${step} (Attempt ${this.stepRetryCount}/2)`);

    if (this.stepRetryCount === 1) {
      await stopAudioRecording();
      this.setState({
        isRecording: false,
        isSpeaking: true,
        statusMessage: `No speech detected. Asking again: "${this.currentPromptText}"`,
      });

      const repeatPhrase = `I didn't catch that. ${this.currentPromptText}`;
      await speakPrompt(repeatPhrase, () => {
        this.beginRecordingStep(step);
      });
    } else {
      await stopAudioRecording();

      // If timed out during cancel confirmation, default to safe cancellation
      if (step === DriveSessionStep.CONFIRM_CANCEL_RECORDING) {
        await speakPrompt("Session canceled.", () => {
          this.cancelSession();
        });
        return;
      }

      this.setState({
        isRecording: false,
        isSpeaking: true,
        statusMessage: 'Session timed out. Saving information received so far...',
      });

      await speakPrompt(
        "Session timed out. Saving information received so far.",
        () => {
          this.saveSessionToQueue();
        }
      );
    }
  }

  /**
   * 1. Start Session: Every workflow begins with "Hey Mark" + Project Selection
   */
  public async startSession(): Promise<void> {
    wakeWordService.stopListening();
    this.clearNoSpeechTimeout();
    this.stepRetryCount = 0;
    this.activeAudioUri = null;
    this.contentAudioUri = null;
    this.previousStepBeforeCancel = null;

    this.setState({
      currentStep: DriveSessionStep.HARDWARE_CHECK,
      currentStepIndex: 0,
      workflowResults: {},
      isNewProject: true,
      projectStatus: 'NEW_PROJECT',
      projectNameText: undefined,
      locationData: undefined,
      statusMessage: 'Loading on-device AI models...',
    });

    const hardware = await hardwareCheckService.evaluateHardwareCapabilities();
    console.log(`[VoiceStateMachine] Hardware Tier: ${hardware.tier}`);

    if (hardware.tier === 'LOCAL_AI') {
      await Promise.all([
        localWhisperService.initializeWhisper(),
        localLlamaEngine.initializeModel(),
      ]);
    }

    await enableAudioDuckFocus();

    // Universal Step 1: Project Selection (Personalized Greeting)
    const userName = appConfigService.getUserName();
    this.currentPromptText = `Hey ${userName}, is this for a new project?`;
    this.stepRetryCount = 0;

    this.setState({
      executionTier: hardware.tier,
      currentStep: DriveSessionStep.Q1_PROJECT_TYPE_PROMPT,
      isSpeaking: true,
      statusMessage: `Step 1: "Hey ${userName}, is this for a new project?"...`,
    });

    await speakPrompt(this.currentPromptText, () => {
      this.beginRecordingStep(DriveSessionStep.Q1_PROJECT_TYPE_RECORDING);
    });
  }

  /**
   * Helper to start audio recording and VAD listener
   */
  private async beginRecordingStep(step: DriveSessionStep): Promise<void> {
    this.vadTracker.reset();
    localWhisperService.startWebLiveTranscription();
    this.startNoSpeechTimeout(step);

    this.setState({
      currentStep: step,
      isRecording: true,
      isSpeaking: false,
      speechDetected: false,
      silenceMs: 0,
      statusMessage: `Listening...`,
    });

    await startAudioRecording((status) => {
      if (status.isRecording && status.metering !== undefined) {
        const vad = this.vadTracker.processAudioLevel(status.metering);
        this.setState({
          meterLevel: status.metering,
          speechDetected: vad.speechDetected,
          silenceMs: vad.silenceMs,
        });

        if (vad.hasStartedSpeaking) {
          this.clearNoSpeechTimeout();
        }

        if (vad.shouldAutoAdvance) {
          console.log(`[VoiceStateMachine] VAD auto-advance triggered for ${step}`);
          this.advanceNextStep();
        }
      }
    });
  }

  /**
   * Prompt confirmation when a stop/cancel keyword is detected
   */
  private async promptCancelConfirmation(originStep: DriveSessionStep): Promise<void> {
    this.clearNoSpeechTimeout();
    this.previousStepBeforeCancel = originStep;
    this.previousPromptBeforeCancel = this.currentPromptText;
    this.currentPromptText = "Are you sure you want to cancel the session?";
    this.stepRetryCount = 0;

    this.setState({
      currentStep: DriveSessionStep.CONFIRM_CANCEL_PROMPT,
      isSpeaking: true,
      isRecording: false,
      statusMessage: 'Stop keyword detected. Confirming cancellation...',
    });

    console.log(`[VoiceStateMachine] Stop keyword spoken. Asking cancel confirmation.`);
    await speakPrompt(this.currentPromptText, () => {
      this.beginRecordingStep(DriveSessionStep.CONFIRM_CANCEL_RECORDING);
    });
  }

  /**
   * 2. Main Step Advancement & Universal Router
   */
  public async advanceNextStep(): Promise<void> {
    this.clearNoSpeechTimeout();
    this.stepRetryCount = 0;
    const current = this.state.currentStep;

    // --- STOP KEYWORD CONFIRMATION RESOLUTION ---
    if (current === DriveSessionStep.CONFIRM_CANCEL_RECORDING) {
      const audioUri = await stopAudioRecording();
      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.CONFIRM_CANCEL_REASONING,
        statusMessage: 'Evaluating cancel confirmation...',
      });

      const transcribedAnswer = await localWhisperService.transcribeAudioFile(audioUri || '', 'Cancel Confirmation');
      const isConfirmed = await localLlamaEngine.classifyYesNo(transcribedAnswer, true);

      if (isConfirmed) {
        console.log('[VoiceStateMachine] Cancellation confirmed by voice. Aborting session.');
        this.setState({
          isSpeaking: true,
          statusMessage: 'Session canceled.',
        });
        await speakPrompt("Session canceled.", () => {
          this.cancelSession();
        });
      } else {
        console.log('[VoiceStateMachine] Cancellation rejected by voice. Resuming session.');
        this.setState({
          isSpeaking: true,
          statusMessage: 'Resuming session...',
        });

        await speakPrompt("Resuming.", () => {
          if (this.previousStepBeforeCancel) {
            this.currentPromptText = this.previousPromptBeforeCancel || "Continuing where we left off.";
            this.beginRecordingStep(this.previousStepBeforeCancel);
          } else {
            this.promptUniversalHelpRouter();
          }
        });
      }
      return;
    }

    // --- PHASE 1: PROJECT SELECTION SUB-FLOW ---
    if (current === DriveSessionStep.Q1_PROJECT_TYPE_RECORDING) {
      const audioUri = await stopAudioRecording();
      this.activeAudioUri = audioUri || `mock://q1_${Date.now()}.m4a`;

      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.Q1_PROJECT_TYPE_REASONING,
        statusMessage: 'Analyzing project intent (New vs Existing)...',
      });

      const transcribedAnswer = await localWhisperService.transcribeAudioFile(this.activeAudioUri, 'Yes or No new project');

      // Check for stop keyword
      if (this.isStopKeyword(transcribedAnswer)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const isNew = await localLlamaEngine.classifyYesNo(transcribedAnswer, true);
      this.setState({ isNewProject: isNew });

      if (isNew) {
        this.currentPromptText = "What is the name of the new project?";
        this.setState({ isSpeaking: true });
        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.Q1A_NEW_NAME_RECORDING);
        });
      } else {
        this.currentPromptText = "Which existing project is this for?";
        this.setState({ isSpeaking: true });
        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.Q1B_EXISTING_NAME_RECORDING);
        });
      }

    } else if (current === DriveSessionStep.Q1A_NEW_NAME_RECORDING) {
      const audioUri = await stopAudioRecording();
      const transcribedName = await localWhisperService.transcribeAudioFile(audioUri || '', 'New Project Name');

      if (this.isStopKeyword(transcribedName)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      // Clean the exact spoken project name cleanly without adding extra words
      const cleanProjectName = cleanSpokenProjectName(transcribedName);

      this.currentPromptText = "Is this the right location?";
      this.setState({
        projectNameText: cleanProjectName,
        isNewProject: true,
        projectStatus: 'NEW_PROJECT',
        isSpeaking: true,
      });

      await speakPrompt(this.currentPromptText, () => {
        this.beginRecordingStep(DriveSessionStep.Q2_LOC_VERIFY_RECORDING);
      });

    } else if (current === DriveSessionStep.Q2_LOC_VERIFY_RECORDING) {
      const audioUri = await stopAudioRecording();
      const locAns = await localWhisperService.transcribeAudioFile(audioUri || '', 'Yes or No location confirmation');

      if (this.isStopKeyword(locAns)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const isLocationRight = await localLlamaEngine.classifyYesNo(locAns, true);

      if (isLocationRight) {
        const gpsLocation = await locationService.getCurrentGPSLocation();
        const projectName = this.state.projectNameText || 'New Regional Project';
        const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        let isSynced = 0;
        if (!firebaseSyncManager.isSimulatedOffline()) {
          const res = await firestoreService.saveProjectToFirestore({
            id: projectId,
            name: projectName,
            created_at: new Date().toISOString(),
            synced: 0,
            latitude: gpsLocation.latitude,
            longitude: gpsLocation.longitude,
          });
          if (res.success) isSynced = 1;
        }

        await sqliteQueueService.createLocalProject(projectName, { latitude: gpsLocation.latitude, longitude: gpsLocation.longitude }, isSynced);

        this.setState({
          locationData: gpsLocation,
        });

        // Advance to Universal Router: "How can I help you today?"
        await this.promptUniversalHelpRouter();
      } else {
        this.currentPromptText = "What is the address or job site location?";
        this.setState({ isSpeaking: true });
        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.Q2A_ADDRESS_RECORDING);
        });
      }

    } else if (current === DriveSessionStep.Q2A_ADDRESS_RECORDING) {
      const audioUri = await stopAudioRecording();
      const rawAddress = await localWhisperService.transcribeAudioFile(audioUri || '', 'Job site address');

      if (this.isStopKeyword(rawAddress)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const cleanAddress = await localLlamaEngine.generateLocalCompletion(
        `Extract just the street address from: "${rawAddress}".`,
        rawAddress || 'Regional Job Site'
      );

      const manualLocation = locationService.createManualAddressLocation(cleanAddress);
      const projectName = this.state.projectNameText || 'New Regional Project';
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      let isSynced = 0;
      if (!firebaseSyncManager.isSimulatedOffline()) {
        const res = await firestoreService.saveProjectToFirestore({
          id: projectId,
          name: projectName,
          created_at: new Date().toISOString(),
          synced: 0,
          address: cleanAddress,
        });
        if (res.success) isSynced = 1;
      }

      await sqliteQueueService.createLocalProject(projectName, { address: cleanAddress }, isSynced);

      this.setState({
        locationData: manualLocation,
      });

      // Advance to Universal Router: "How can I help you today?"
      await this.promptUniversalHelpRouter();

    } else if (current === DriveSessionStep.Q1B_EXISTING_NAME_RECORDING) {
      const audioUri = await stopAudioRecording();
      const queryText = await localWhisperService.transcribeAudioFile(audioUri || '', 'Existing Project Search');

      if (this.isStopKeyword(queryText)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const matched = await sqliteQueueService.searchLocalProjects(queryText);

      const finalName = matched ? matched.name : queryText;
      const status: ProjectResolutionStatus = matched ? 'MATCHED' : 'EXISTING_PENDING_MATCH';

      this.setState({
        projectNameText: finalName,
        isNewProject: false,
        projectStatus: status,
        matchedProjectId: matched?.id,
      });

      // Advance to Universal Router: "How can I help you today?"
      await this.promptUniversalHelpRouter();

    // --- PHASE 2: UNIVERSAL INTENT ROUTER ("How can I help you today?") ---
    } else if (current === DriveSessionStep.UNIVERSAL_HELP_ROUTER_RECORDING) {
      const audioUri = await stopAudioRecording();
      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.UNIVERSAL_HELP_ROUTER_REASONING,
        statusMessage: 'Routing intent with Llama 3.2...',
      });

      const spokenIntent = await localWhisperService.transcribeAudioFile(audioUri || '', 'Universal Intent Response');

      if (this.isStopKeyword(spokenIntent)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const matchedWorkflow = localLlamaEngine.classifyWorkflowIntent(spokenIntent, DEFAULT_WORKFLOW_TEMPLATES);

      console.log(`[VoiceStateMachine] Routed to workflow: ${matchedWorkflow.name}`);
      this.setActiveWorkflow(matchedWorkflow);

      // Start the specific workflow steps
      await this.executeWorkflowStepAtIndex(0);

    // --- PHASE 3: DYNAMIC WORKFLOW STEP HANDLER ---
    } else if (current === DriveSessionStep.WORKFLOW_STEP_RECORDING) {
      const stepDef = this.state.currentStepDefinition;
      if (!stepDef) {
        await this.completeWorkflowExecution();
        return;
      }

      const audioUri = await stopAudioRecording();
      if (!this.contentAudioUri) this.contentAudioUri = audioUri || `mock://audio_${Date.now()}.m4a`;

      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.WORKFLOW_STEP_REASONING,
        statusMessage: `Processing ${stepDef.name} with Llama 3.2...`,
      });

      const rawTranscript = await localWhisperService.transcribeAudioFile(audioUri || '', stepDef.name);

      if (this.isStopKeyword(rawTranscript)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      let extractedValue: any = rawTranscript;

      if (stepDef.type === 'YES_NO_QUESTION') {
        extractedValue = await localLlamaEngine.classifyYesNo(rawTranscript, true);
      } else if (stepDef.type === 'ACTION_ITEMS_CHECKLIST') {
        const checklist = await localLlamaEngine.generateLocalCompletion(
          `Extract semicolon-delimited action checklist from: "${rawTranscript}".`,
          rawTranscript || stepDef.placeholderFallback || 'Follow up on site inspection'
        );
        extractedValue = checklist;
        this.setState({ actionItemsText: checklist });
      } else if (stepDef.type === 'STRUCTURED_EXTRACTION') {
        const structured = await localLlamaEngine.generateLocalCompletion(
          `Goal: ${stepDef.extractionGoal || 'Extract structured data'}. Input: "${rawTranscript}". Format concise clean string.`,
          rawTranscript || stepDef.placeholderFallback || 'Structured data recorded'
        );
        extractedValue = structured;
      } else {
        // FREE_TEXT_SUMMARY
        const summary = await localLlamaEngine.generateLocalCompletion(
          `Summarize concisely in 2 sentences: "${rawTranscript}".`,
          rawTranscript || stepDef.placeholderFallback || 'Site observation recorded.'
        );
        extractedValue = summary;
        this.setState({ rawTranscriptText: summary });
      }

      this.recordStepResult(stepDef.id, extractedValue);

      // Advance to next step in workflow
      await this.executeWorkflowStepAtIndex(this.state.currentStepIndex + 1);
    }
  }

  /**
   * Prompts the Universal Intent Router: "How can I help you today?"
   */
  private async promptUniversalHelpRouter(): Promise<void> {
    this.currentPromptText = "How can I help you today?";
    this.stepRetryCount = 0;

    this.setState({
      currentStep: DriveSessionStep.UNIVERSAL_HELP_ROUTER_PROMPT,
      isSpeaking: true,
      statusMessage: 'Project saved. Asking: "How can I help you today?"...',
    });

    await speakPrompt(this.currentPromptText, () => {
      this.beginRecordingStep(DriveSessionStep.UNIVERSAL_HELP_ROUTER_RECORDING);
    });
  }

  /**
   * Executes dynamic workflow step by index
   */
  private async executeWorkflowStepAtIndex(index: number): Promise<void> {
    const workflow = this.state.activeWorkflow;
    if (index >= workflow.steps.length) {
      await this.completeWorkflowExecution();
      return;
    }

    const step = workflow.steps[index];
    this.currentPromptText = step.prompt;
    this.stepRetryCount = 0;

    this.setState({
      currentStepIndex: index,
      currentStepDefinition: step,
      isSpeaking: true,
      currentStep: DriveSessionStep.WORKFLOW_STEP_PROMPT,
      statusMessage: `Step ${index + 1} of ${workflow.steps.length}: ${step.name}`,
    });

    await speakPrompt(step.prompt, () => {
      this.beginRecordingStep(DriveSessionStep.WORKFLOW_STEP_RECORDING);
    });
  }

  private recordStepResult(stepId: string, value: any): void {
    const updated = { ...this.state.workflowResults, [stepId]: value };
    this.setState({ workflowResults: updated });
    console.log(`[VoiceStateMachine] Recorded step result [${stepId}]:`, value);
  }

  /**
   * 3. Complete Workflow & Save to SQLite / Firestore
   */
  private async completeWorkflowExecution(): Promise<void> {
    const workflow = this.state.activeWorkflow;
    this.setState({
      currentStep: DriveSessionStep.SAVING_QUEUE,
      statusMessage: `Completing ${workflow.name} & saving to queue...`,
    });

    const noteId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    let actionItemsArray: string[] = [];
    if (this.state.actionItemsText) {
      actionItemsArray = this.state.actionItemsText.split(';').map((s) => s.trim()).filter(Boolean);
    } else {
      actionItemsArray = Object.entries(this.state.workflowResults)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }

    const summary = this.state.rawTranscriptText ||
      `Workflow ${workflow.name} recorded for project ${this.state.projectNameText || 'General'}.`;

    const record: NoteQueueRecord = {
      id: noteId,
      timestamp: new Date().toISOString(),
      business_id: appConfigService.getBusinessId(),
      user_id: appConfigService.getUserId(),
      user_name: appConfigService.getUserName(),
      workflow_id: workflow.id,
      workflow_title: workflow.name,
      project_name: this.state.projectNameText || 'General Field Operation',
      is_new_project: this.state.isNewProject,
      project_status: this.state.projectStatus,
      matched_project_id: this.state.matchedProjectId,
      latitude: this.state.locationData?.latitude,
      longitude: this.state.locationData?.longitude,
      location_address: this.state.locationData?.address,
      location_type: this.state.locationData?.locationType || 'NOT_SET',
      raw_transcript: summary,
      action_items: JSON.stringify(actionItemsArray),
      structured_data: JSON.stringify(this.state.workflowResults),
      audio_file_path: this.contentAudioUri || `mock://voice_${noteId}.m4a`,
      sync_status: 'PENDING_SYNC',
    };

    await sqliteQueueService.enqueueNote(record);
    await releaseAudioFocus();

    this.setState({
      currentStep: DriveSessionStep.SESSION_COMPLETE,
      isSpeaking: true,
      statusMessage: `${workflow.name} logged offline. Music resumed.`,
    });

    await speakPrompt(workflow.completionMessage, () => {
      this.setState({
        currentStep: DriveSessionStep.IDLE,
        isSpeaking: false,
      });
      wakeWordService.startListening();
      firebaseSyncManager.syncPendingQueue();
    });
  }

  private async saveSessionToQueue(): Promise<void> {
    await this.completeWorkflowExecution();
  }

  public async cancelSession(): Promise<void> {
    this.clearNoSpeechTimeout();
    this.stepRetryCount = 0;
    this.previousStepBeforeCancel = null;
    await stopSpeech();
    await cancelAudioRecording();
    await releaseAudioFocus();
    this.setState(this.getInitialState());
    wakeWordService.startListening();
  }
}

export const voiceStateMachine = new VoiceStateMachine();
