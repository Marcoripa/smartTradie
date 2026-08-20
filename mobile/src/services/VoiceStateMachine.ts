import { hardwareCheckService, ExecutionTier } from './HardwareCheckService';
export { ExecutionTier };
import {
  sqliteQueueService,
  NoteQueueRecord,
  ProjectRecord,
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

  // Fuzzy Match Project Confirmation Step
  CONFIRM_PROJECT_MATCH_PROMPT = 'CONFIRM_PROJECT_MATCH_PROMPT',
  CONFIRM_PROJECT_MATCH_RECORDING = 'CONFIRM_PROJECT_MATCH_RECORDING',
  CONFIRM_PROJECT_MATCH_REASONING = 'CONFIRM_PROJECT_MATCH_REASONING',

  // Create New Project when Existing Not Found Confirmation Step
  CONFIRM_CREATE_NEW_PROJECT_PROMPT = 'CONFIRM_CREATE_NEW_PROJECT_PROMPT',
  CONFIRM_CREATE_NEW_PROJECT_RECORDING = 'CONFIRM_CREATE_NEW_PROJECT_RECORDING',
  CONFIRM_CREATE_NEW_PROJECT_REASONING = 'CONFIRM_CREATE_NEW_PROJECT_REASONING',

  Q2_LOC_VERIFY_RECORDING = 'Q2_LOC_VERIFY_RECORDING',
  Q2A_ADDRESS_RECORDING = 'Q2A_ADDRESS_RECORDING',

  // Phase 2: Universal Intent Router & One-Shot Slot Filling ("How can I help you today?")
  UNIVERSAL_HELP_ROUTER_PROMPT = 'UNIVERSAL_HELP_ROUTER_PROMPT',
  UNIVERSAL_HELP_ROUTER_RECORDING = 'UNIVERSAL_HELP_ROUTER_RECORDING',
  UNIVERSAL_HELP_ROUTER_REASONING = 'UNIVERSAL_HELP_ROUTER_REASONING',

  // Phase 3: Dynamic Workflow Specific Steps (Guided Fallback)
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

  // Fuzzy match candidate
  candidateFuzzyProject?: ProjectRecord;
  originalSpokenProjectName?: string;

  // Accumulated dynamic step extractions
  workflowResults: Record<string, any>;
  rawTranscriptText?: string;
  actionItemsText?: string;
  statusMessage: string;
}

/**
 * Robust Acoustic Phonetic Normalizer & Binary Intent Classifier
 * Accurately catches Whisper misrecognitions (e.g. "now" / "know" for "no", "yeh" for "yes")
 */
export class BinaryIntentClassifier {
  private static readonly NO_TOKENS = new Set([
    'no',
    'now',     // common Whisper misrecognition of "no"
    'know',    // common Whisper misrecognition of "no"
    'naw',
    'nau',
    'gnaw',
    'nah',
    'nope',
    'not',
    'none',
    'noo',
    'nooo',
    'negative',
    'wrong',
    'cancel',
    'stop',
    'different',
    'never',
    'abort',
    'quit',
  ]);

  private static readonly NO_PHRASES = [
    'no thanks',
    'no thank you',
    'not that',
    'not this',
    'do not',
    "don't",
    'no way',
    'wrong one',
    'different one',
    'wrong project',
    'other project',
    'not really',
    'nope mate',
    'no mate',
  ];

  private static readonly YES_TOKENS = new Set([
    'yes',
    'yeah',
    'yep',
    'yup',
    'ya',
    'yah',
    'yea',
    'yeh',
    'yess',
    'aye',
    'sure',
    'correct',
    'right',
    'affirmative',
    'confirm',
    'ok',
    'okay',
    'yessir',
  ]);

  private static readonly YES_PHRASES = [
    "that's it",
    'thats it',
    'that is it',
    "that's right",
    'thats right',
    'sounds good',
    'go ahead',
    'create it',
    'new one',
    'correct project',
    'too right',
    'all good',
  ];

  public static classify(spokenText: string | null | undefined): 'YES' | 'NO' | 'UNKNOWN' {
    if (!spokenText) return 'UNKNOWN';
    const clean = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    if (!clean) return 'UNKNOWN';

    // 1. Check exact phrase matches
    for (const phrase of BinaryIntentClassifier.NO_PHRASES) {
      if (clean.includes(phrase)) return 'NO';
    }
    for (const phrase of BinaryIntentClassifier.YES_PHRASES) {
      if (clean.includes(phrase)) return 'YES';
    }

    // 2. Tokenize
    const tokens = clean.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return 'UNKNOWN';

    let hasNo = false;
    let hasYes = false;

    for (const token of tokens) {
      if (BinaryIntentClassifier.NO_TOKENS.has(token)) {
        hasNo = true;
      }
      if (BinaryIntentClassifier.YES_TOKENS.has(token)) {
        hasYes = true;
      }
    }

    if (hasNo && !hasYes) return 'NO';
    if (hasYes && !hasNo) return 'YES';

    // Single word short homophone catch
    if (tokens.length === 1) {
      const single = tokens[0];
      if (single.startsWith('no') || single === 'now' || single === 'know' || single === 'naw' || single === 'nah') {
        return 'NO';
      }
      if (single.startsWith('ye') || single === 'ya' || single === 'yah' || single === 'yep' || single === 'yup') {
        return 'YES';
      }
    }

    return 'UNKNOWN';
  }
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
   * Classifies user affirmation (YES vs NO) for conversational branching & fuzzy project confirmation
   */
  public async classifyYesNo(spokenText: string, fallbackDefault = false): Promise<boolean> {
    const directResult = BinaryIntentClassifier.classify(spokenText);
    if (directResult === 'YES') {
      console.log(`[BinaryIntentClassifier] Spoken "${spokenText}" -> Classified as YES`);
      return true;
    }
    if (directResult === 'NO') {
      console.log(`[BinaryIntentClassifier] Spoken "${spokenText}" -> Classified as NO`);
      return false;
    }

    if (this.isLoaded && this.llamaContext && spokenText.trim().length > 0) {
      try {
        const answer = await this.generateLocalCompletion(
          `Does this statement indicate "YES" (affirmative) or "NO" (negative)? Statement: "${spokenText}". Answer ONLY with "YES" or "NO".`,
          fallbackDefault ? 'YES' : 'NO'
        );
        const upper = answer.toUpperCase().trim();
        if (upper.includes('YES')) return true;
        if (upper.includes('NO')) return false;
      } catch (e) {
        console.warn('[LocalLlamaEngine] Classification error:', e);
      }
    }

    console.log(`[BinaryIntentClassifier] Spoken "${spokenText}" -> UNRESOLVED (fallback: ${fallbackDefault})`);
    return fallbackDefault;
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

    if (lower.includes('material') || lower.includes('part') || lower.includes('stock') || lower.includes('deduct') || lower.includes('inventory') || lower.includes('pipe') || lower.includes('cement') || lower.includes('elbow') || lower.includes('fitting')) {
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

  /**
   * Extracts one-shot slots from a conversational utterance (One-Shot Slot Filling)
   */
  public extractOneShotSlots(
    spokenText: string,
    workflow: WorkflowTemplate
  ): { slots: Record<string, any>; summary?: string; actionItems?: string } {
    const textLower = spokenText.toLowerCase();
    const slots: Record<string, any> = {};
    let summary: string | undefined;
    let actionItems: string | undefined;

    if (workflow.id === 'workflow_materials_used') {
      // Look for quantities and materials mentioned in the utterance
      // e.g. "3 PVC elbows and 2 bags of rapid set" or "used 5 rolls of tape"
      const matRegex = /\b(\d+)\s*(x|\s)?\s*([a-z0-9\s\-]+?)(?:,\s*|\s+and\s+|\s+plus\s+|$)/gi;
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = matRegex.exec(spokenText)) !== null) {
        const item = m[0].trim().replace(/^and\s+/i, '');
        if (item && item.length > 2) {
          matches.push(item);
        }
      }
      if (matches.length > 0) {
        slots['materials_list'] = matches.join('; ');
        summary = `Used materials: ${slots['materials_list']}`;
      } else if (textLower.includes('material') || textLower.includes('part') || textLower.includes('used')) {
        const clean = spokenText.replace(/^(log|used|materials|parts|deduct)\s+/i, '').trim();
        if (clean.length > 3) {
          slots['materials_list'] = clean;
          summary = `Used materials: ${clean}`;
        }
      }
    } else if (workflow.id === 'workflow_voice_note') {
      // If the user spoke a comprehensive note (> 5 words)
      const words = spokenText.trim().split(/\s+/);
      if (words.length >= 5) {
        slots['main_observation'] = spokenText.trim();
        summary = spokenText.trim();

        // Check if action items are included
        const actionTriggers = ['order', 'schedule', 'follow up', 'need to', 'reorder', 'call', 'check next'];
        const matchedTrigger = actionTriggers.find((t) => textLower.includes(t));
        if (matchedTrigger) {
          const actionIdx = textLower.indexOf(matchedTrigger);
          const actionPart = spokenText.slice(actionIdx).trim();
          slots['followup_actions'] = actionPart;
          actionItems = actionPart;
        }
      }
    } else if (workflow.id === 'workflow_job_clocking') {
      if (textLower.includes('clock in') || textLower.includes('start job') || textLower.includes('started work')) {
        slots['clock_action'] = 'CLOCK_IN';
      } else if (textLower.includes('clock out') || textLower.includes('finish job') || textLower.includes('finished work')) {
        slots['clock_action'] = 'CLOCK_OUT';
      }
      const notePart = spokenText.replace(/(clock in|clock out|start job|finish job)/gi, '').trim();
      if (notePart.length > 5) {
        slots['work_scope'] = notePart;
        summary = notePart;
      }
    } else if (workflow.id === 'workflow_safety_audit') {
      if (textLower.includes('no hazard') || textLower.includes('all safe') || textLower.includes('clear')) {
        slots['hazards_detected'] = 'No hazards detected. Site clear.';
        slots['ppe_signoff'] = true;
      }
    }

    return { slots, summary, actionItems };
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

  // Fuzzy project matching tracking
  private candidateFuzzyProject?: ProjectRecord;
  private originalSpokenProjectName?: string;

  // Timeout & Retry management (8.5s silence waiting for voice input)
  private currentPromptText = "Is this for a new project?";
  private stepRetryCount = 0;
  private noSpeechTimeoutTimer: any = null;
  private readonly NO_SPEECH_TIMEOUT_MS = 10000;

  // Cancel confirmation state tracking
  private previousStepBeforeCancel: DriveSessionStep | null = null;
  private previousPromptBeforeCancel: string = '';

  // Atomic state advancement lock & live speech transcript holder
  private isAdvancing = false;
  private lastRecognizedInterimTranscript: string | null = null;

  constructor() {
    this.vadTracker = new VADTracker();
    this.state = this.getInitialState();
  }

  private isShortAnswerStep(step: DriveSessionStep): boolean {
    return (
      step === DriveSessionStep.Q1_PROJECT_TYPE_RECORDING ||
      step === DriveSessionStep.Q2_LOC_VERIFY_RECORDING ||
      step === DriveSessionStep.CONFIRM_PROJECT_MATCH_RECORDING ||
      step === DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_RECORDING ||
      step === DriveSessionStep.CONFIRM_CANCEL_RECORDING ||
      (step === DriveSessionStep.WORKFLOW_STEP_RECORDING &&
        this.state.currentStepDefinition?.type === 'YES_NO_QUESTION')
    );
  }

  private hasAffirmativeOrNegativeAnswer(text: string): boolean {
    const classification = BinaryIntentClassifier.classify(text);
    return classification === 'YES' || classification === 'NO';
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

    // If driver has already spoken or is actively speaking, ignore the initial no-speech timeout
    if (this.vadTracker.getHasStartedSpeaking() || this.state.speechDetected) {
      console.log(`[VoiceStateMachine] Ignoring no-speech timeout for step ${step} because speech was already captured.`);
      return;
    }

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
    this.candidateFuzzyProject = undefined;
    this.originalSpokenProjectName = undefined;

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

    this.setState({
      executionTier: hardware.tier,
    });

    // Start Phase 1 Question 1: "Hi {userName}, is this for a new project?"
    const userName = appConfigService.getUserName() || 'there';
    this.currentPromptText = `Hi ${userName}, is this for a new project?`;
    this.setState({
      currentStep: DriveSessionStep.Q1_PROJECT_TYPE_PROMPT,
      isSpeaking: true,
      statusMessage: `Question 1: "Hi ${userName}, is this for a new project?"`,
    });

    await enableAudioDuckFocus();
    await speakPrompt(this.currentPromptText, () => {
      this.beginRecordingStep(DriveSessionStep.Q1_PROJECT_TYPE_RECORDING);
    });
  }

  private async beginRecordingStep(step: DriveSessionStep): Promise<void> {
    this.clearNoSpeechTimeout();
    this.vadTracker.reset();

    const isShortAnswer = this.isShortAnswerStep(step);

    if (isShortAnswer) {
      // Ultra-fast VAD cutoff for yes/no questions (350ms silence vs 2000ms)
      this.vadTracker.setConfig({
        requiredSilenceMs: 350,
        minSpeechDurationMs: 150,
      });
    } else {
      // Standard VAD cutoff for open-ended speech
      this.vadTracker.setConfig({
        requiredSilenceMs: 2000,
        minSpeechDurationMs: 600,
      });
    }

    // Live keyword spotter and speech detector: cancel no-speech timer as soon as user speaks
    this.lastRecognizedInterimTranscript = null;
    localWhisperService.setOnInterimTranscript((interim) => {
      this.clearNoSpeechTimeout();
      this.lastRecognizedInterimTranscript = interim;

      if (isShortAnswer && !this.isAdvancing && this.hasAffirmativeOrNegativeAnswer(interim)) {
        console.log(`[VoiceStateMachine] ⚡ Instant short answer recognized: "${interim}". Advancing step immediately!`);
        this.advanceNextStep();
      }
    });

    // Start Web live speech recognition buffer if in web browser preview
    localWhisperService.startWebLiveTranscription();

    await startAudioRecording((status) => {
      if (!status.isRecording) return;

      const meter = status.metering ?? -160;
      const vadStatus = this.vadTracker.processAudioLevel(meter);

      if (vadStatus.speechDetected || vadStatus.hasStartedSpeaking) {
        this.clearNoSpeechTimeout();
      }

      this.setState({
        meterLevel: meter,
        speechDetected: vadStatus.speechDetected,
        silenceMs: vadStatus.silenceMs,
      });

      if (vadStatus.shouldAutoAdvance && !this.isAdvancing) {
        console.log(`[VoiceStateMachine] VAD auto-cutoff triggered for step ${step}. Advancing.`);
        this.advanceNextStep();
      }
    });

    this.setState({
      currentStep: step,
      isRecording: true,
      isSpeaking: false,
      statusMessage: isShortAnswer ? `Listening for quick answer (Yes/No)...` : `Listening for response...`,
    });

    this.startNoSpeechTimeout(step);
  }

  public async advanceNextStep(): Promise<void> {
    if (this.isAdvancing) return;
    this.isAdvancing = true;
    this.clearNoSpeechTimeout();
    localWhisperService.setOnInterimTranscript(null);

    try {
      await this.handleAdvanceStep();
    } finally {
      this.isAdvancing = false;
    }
  }

  private async promptCancelConfirmation(previousStep: DriveSessionStep): Promise<void> {
    this.previousStepBeforeCancel = previousStep;
    this.previousPromptBeforeCancel = this.currentPromptText;
    this.currentPromptText = "Are you sure you want to cancel?";

    console.log(`[VoiceStateMachine] Stop keyword detected. Prompting cancel confirmation from step ${previousStep}`);

    this.setState({
      currentStep: DriveSessionStep.CONFIRM_CANCEL_PROMPT,
      isSpeaking: true,
      statusMessage: 'Cancel requested. Asking: "Are you sure you want to cancel?"...',
    });

    await speakPrompt(this.currentPromptText, () => {
      this.beginRecordingStep(DriveSessionStep.CONFIRM_CANCEL_RECORDING);
    });
  }

  /**
   * Graceful recovery for uncaught/empty voice answers (2-Tier: Reprompt -> Safe Fallback)
   */
  private async handleMissedAnswer(step: DriveSessionStep, fallbackAction: () => Promise<void>): Promise<boolean> {
    if (this.stepRetryCount === 0) {
      this.stepRetryCount = 1;
      console.log(`[VoiceStateMachine] ⚠️ Missed speech on step ${step}. Reprompting (Attempt 1/2)...`);
      this.setState({
        isRecording: false,
        isSpeaking: true,
        statusMessage: `I didn't catch that. Asking again...`,
      });

      const reprompt = `I didn't catch that. ${this.currentPromptText}`;
      await speakPrompt(reprompt, () => {
        this.beginRecordingStep(step);
      });
      return true; // handled by reprompt
    }

    // Attempt 2: execute safe fallback
    this.stepRetryCount = 0;
    console.log(`[VoiceStateMachine] ⚠️ Second missed speech on step ${step}. Executing safe fallback...`);
    await fallbackAction();
    return true;
  }

  private async handleAdvanceStep(): Promise<void> {
    const current = this.state.currentStep;

    // --- HANDS-FREE CANCEL CONFIRMATION SUB-FLOW ---
    if (current === DriveSessionStep.CONFIRM_CANCEL_RECORDING) {
      const audioUri = await stopAudioRecording();
      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.CONFIRM_CANCEL_REASONING,
        statusMessage: 'Evaluating cancel confirmation...',
      });

      let transcribedAnswer = await localWhisperService.transcribeAudioFile(audioUri || '', 'Cancel Confirmation');
      if ((!transcribedAnswer || transcribedAnswer.trim().length === 0) && this.lastRecognizedInterimTranscript) {
        transcribedAnswer = this.lastRecognizedInterimTranscript;
      }

      if (!transcribedAnswer || transcribedAnswer.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          console.log('[VoiceStateMachine] Defaulting to resuming session after silence.');
          await speakPrompt("Resuming.", () => {
            if (this.previousStepBeforeCancel) {
              this.currentPromptText = this.previousPromptBeforeCancel || "Continuing where we left off.";
              this.beginRecordingStep(this.previousStepBeforeCancel);
            } else {
              this.promptUniversalHelpRouter();
            }
          });
        });
        if (handled) return;
      }

      const isConfirmed = await localLlamaEngine.classifyYesNo(transcribedAnswer, false);

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

      let transcribedAnswer = await localWhisperService.transcribeAudioFile(this.activeAudioUri, 'Yes or No');
      if ((!transcribedAnswer || transcribedAnswer.trim().length === 0) && this.lastRecognizedInterimTranscript) {
        transcribedAnswer = this.lastRecognizedInterimTranscript;
      }
      console.log(`🗣️ [Voice Answer - "Is this for a new project?"]: "${transcribedAnswer}"`);

      // Check if missed speech
      if (!transcribedAnswer || transcribedAnswer.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          console.log('[VoiceStateMachine] Defaulting to New Project after missed speech.');
          this.setState({ isNewProject: true });
          this.currentPromptText = "What is the name of the new project?";
          this.setState({ isSpeaking: true });
          await speakPrompt(this.currentPromptText, () => {
            this.beginRecordingStep(DriveSessionStep.Q1A_NEW_NAME_RECORDING);
          });
        });
        if (handled) return;
      }

      // Check for stop keyword
      if (this.isStopKeyword(transcribedAnswer)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const isNew = await localLlamaEngine.classifyYesNo(transcribedAnswer, false);
      console.log(`🤖 [Project Classification]: isNewProject = ${isNew} (${isNew ? 'NEW PROJECT' : 'EXISTING PROJECT'})`);
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

      if (!transcribedName || transcribedName.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          const defaultName = `Site Note - ${new Date().toLocaleDateString('en-AU')}`;
          console.log(`[VoiceStateMachine] Defaulting project name to: ${defaultName}`);
          this.currentPromptText = "Is this the right location?";
          this.setState({
            projectNameText: defaultName,
            isNewProject: true,
            projectStatus: 'NEW_PROJECT',
            isSpeaking: true,
          });
          await speakPrompt(this.currentPromptText, () => {
            this.beginRecordingStep(DriveSessionStep.Q2_LOC_VERIFY_RECORDING);
          });
        });
        if (handled) return;
      }

      if (this.isStopKeyword(transcribedName)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const cleanProjectName = cleanSpokenProjectName(transcribedName);

      // Check if this project name matches an existing project via fuzzy matching
      const matchResult = await sqliteQueueService.searchLocalProjects(cleanProjectName, this.state.locationData);
      if (matchResult.isFuzzyConfirmationNeeded && matchResult.bestMatch) {
        this.candidateFuzzyProject = matchResult.bestMatch;
        this.originalSpokenProjectName = cleanProjectName;
        this.currentPromptText = `Did you mean ${matchResult.bestMatch.name}?`;
        this.setState({
          projectNameText: matchResult.bestMatch.name,
          currentStep: DriveSessionStep.CONFIRM_PROJECT_MATCH_PROMPT,
          isSpeaking: true,
          statusMessage: `Fuzzy Match (${Math.round(matchResult.confidence * 100)}%): "Did you mean ${matchResult.bestMatch.name}?"`,
        });

        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.CONFIRM_PROJECT_MATCH_RECORDING);
        });
        return;
      }

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

      if (!locAns || locAns.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          const gpsLocation = await locationService.getCurrentGPSLocation();
          this.setState({ locationData: gpsLocation });
          await this.promptUniversalHelpRouter();
        });
        if (handled) return;
      }

      if (this.isStopKeyword(locAns)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const isLocationRight = await localLlamaEngine.classifyYesNo(locAns, true);

      if (isLocationRight) {
        const gpsLocation = await locationService.getCurrentGPSLocation();
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

      if (!rawAddress || rawAddress.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          const gpsLocation = await locationService.getCurrentGPSLocation();
          this.setState({ locationData: gpsLocation });
          await this.promptUniversalHelpRouter();
        });
        if (handled) return;
      }

      if (this.isStopKeyword(rawAddress)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const cleanAddress = await localLlamaEngine.generateLocalCompletion(
        `Extract just the street address from: "${rawAddress}".`,
        rawAddress || 'Regional Job Site'
      );

      const manualLocation = locationService.createManualAddressLocation(cleanAddress);
      this.setState({
        locationData: manualLocation,
      });

      // Advance to Universal Router: "How can I help you today?"
      await this.promptUniversalHelpRouter();

    } else if (current === DriveSessionStep.Q1B_EXISTING_NAME_RECORDING) {
      const audioUri = await stopAudioRecording();
      const queryText = await localWhisperService.transcribeAudioFile(audioUri || '', 'Existing Project Search');

      if (!queryText || queryText.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          const defaultName = `Site Note - ${new Date().toLocaleDateString('en-AU')}`;
          this.setState({
            projectNameText: defaultName,
            isNewProject: true,
            projectStatus: 'NEW_PROJECT',
          });
          await this.promptUniversalHelpRouter();
        });
        if (handled) return;
      }

      if (this.isStopKeyword(queryText)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      // Perform 3-Tier Fuzzy Project Matching (Token overlap + Trade Synonyms + GPS Proximity)
      const matchResult = await sqliteQueueService.searchLocalProjects(queryText, this.state.locationData);
      console.log(`[VoiceStateMachine] Project Search Result for "${queryText}":`, matchResult);

      if (matchResult.isFuzzyConfirmationNeeded && matchResult.bestMatch) {
        // Confidence between 70% and 94% -> Ask voice confirmation
        this.candidateFuzzyProject = matchResult.bestMatch;
        this.originalSpokenProjectName = queryText;
        this.currentPromptText = `Did you mean ${matchResult.bestMatch.name}?`;
        this.setState({
          projectNameText: matchResult.bestMatch.name,
          currentStep: DriveSessionStep.CONFIRM_PROJECT_MATCH_PROMPT,
          isSpeaking: true,
          statusMessage: `Fuzzy Match (${Math.round(matchResult.confidence * 100)}%): "Did you mean ${matchResult.bestMatch.name}?"`,
        });

        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.CONFIRM_PROJECT_MATCH_RECORDING);
        });
        return;
      } else if (matchResult.bestMatch && matchResult.confidence >= 0.95) {
        // Confidence >= 95% -> Auto-bind directly
        console.log(`[VoiceStateMachine] Direct match auto-selected: ${matchResult.bestMatch.name}`);
        this.setState({
          projectNameText: matchResult.bestMatch.name,
          isNewProject: false,
          projectStatus: 'MATCHED',
          matchedProjectId: matchResult.bestMatch.id,
        });
        await this.promptUniversalHelpRouter();
      } else {
        // Low confidence / not found -> Ask if user wants to create a new project
        console.log(`[VoiceStateMachine] Project "${queryText}" not found. Prompting to create new project.`);
        this.originalSpokenProjectName = queryText;
        this.candidateFuzzyProject = undefined;
        this.currentPromptText = `I could not find project ${queryText}, do you want me to create a new project?`;
        this.setState({
          projectNameText: queryText,
          currentStep: DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_PROMPT,
          isSpeaking: true,
          statusMessage: `Project not found. Asking: "${this.currentPromptText}"`,
        });

        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_RECORDING);
        });
        return;
      }

    // --- FUZZY MATCH CONFIRMATION STEP ---
    } else if (current === DriveSessionStep.CONFIRM_PROJECT_MATCH_RECORDING) {
      const audioUri = await stopAudioRecording();
      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.CONFIRM_PROJECT_MATCH_REASONING,
        statusMessage: 'Processing project match confirmation...',
      });

      const confirmAnswer = await localWhisperService.transcribeAudioFile(audioUri || '', 'Project Confirmation');

      if (!confirmAnswer || confirmAnswer.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          const requestedName = this.originalSpokenProjectName || 'requested';
          console.log(`[VoiceStateMachine] No answer to project match confirmation. Asking to create new project: ${requestedName}`);
          this.candidateFuzzyProject = undefined;
          this.currentPromptText = `I could not find project ${requestedName}, do you want me to create a new project?`;
          this.setState({
            projectNameText: requestedName,
            currentStep: DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_PROMPT,
            isSpeaking: true,
            statusMessage: `Asking: "${this.currentPromptText}"`,
          });
          await speakPrompt(this.currentPromptText, () => {
            this.beginRecordingStep(DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_RECORDING);
          });
        });
        if (handled) return;
      }

      if (this.isStopKeyword(confirmAnswer)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const isAffirmative = await localLlamaEngine.classifyYesNo(confirmAnswer, false);

      if (isAffirmative && this.candidateFuzzyProject) {
        console.log(`[VoiceStateMachine] User CONFIRMED project match: ${this.candidateFuzzyProject.name}`);
        this.setState({
          projectNameText: this.candidateFuzzyProject.name,
          isNewProject: false,
          projectStatus: 'MATCHED',
          matchedProjectId: this.candidateFuzzyProject.id,
        });
        this.candidateFuzzyProject = undefined;
        this.originalSpokenProjectName = undefined;
        await this.promptUniversalHelpRouter();
      } else {
        const requestedName = this.originalSpokenProjectName || 'requested';
        console.log(`[VoiceStateMachine] User REJECTED project match. Asking to create new project: ${requestedName}`);
        this.candidateFuzzyProject = undefined;
        this.currentPromptText = `I could not find project ${requestedName}, do you want me to create a new project?`;
        this.setState({
          projectNameText: requestedName,
          currentStep: DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_PROMPT,
          isSpeaking: true,
          statusMessage: `Asking: "${this.currentPromptText}"`,
        });

        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_RECORDING);
        });
        return;
      }

    // --- CREATE NEW PROJECT AFTER NOT FOUND CONFIRMATION STEP ---
    } else if (current === DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_RECORDING) {
      const audioUri = await stopAudioRecording();
      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.CONFIRM_CREATE_NEW_PROJECT_REASONING,
        statusMessage: 'Processing new project creation confirmation...',
      });

      const confirmAnswer = await localWhisperService.transcribeAudioFile(audioUri || '', 'Create New Project Confirmation');

      if (!confirmAnswer || confirmAnswer.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          console.log('[VoiceStateMachine] Closing workflow after unanswered new project confirmation.');
          this.setState({ isSpeaking: true, statusMessage: 'Workflow closed.' });
          await speakPrompt("Workflow closed.", () => {
            this.cancelSession();
          });
        });
        if (handled) return;
      }

      if (this.isStopKeyword(confirmAnswer)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const isAffirmative = await localLlamaEngine.classifyYesNo(confirmAnswer, false);

      if (isAffirmative) {
        const newProjName = cleanSpokenProjectName(this.originalSpokenProjectName || 'New Project');
        console.log(`[VoiceStateMachine] User agreed to create new project: "${newProjName}"`);
        this.currentPromptText = "Is this the right location?";
        this.setState({
          projectNameText: newProjName,
          isNewProject: true,
          projectStatus: 'NEW_PROJECT',
          matchedProjectId: undefined,
          isSpeaking: true,
        });

        await speakPrompt(this.currentPromptText, () => {
          this.beginRecordingStep(DriveSessionStep.Q2_LOC_VERIFY_RECORDING);
        });
      } else {
        console.log('[VoiceStateMachine] User declined creating a new project. Closing workflow.');
        this.setState({
          isSpeaking: true,
          statusMessage: 'Workflow closed.',
        });
        await speakPrompt("Workflow closed.", () => {
          this.cancelSession();
        });
      }

    // --- PHASE 2: UNIVERSAL INTENT ROUTER & ONE-SHOT SLOT EXTRACTION ---
    } else if (current === DriveSessionStep.UNIVERSAL_HELP_ROUTER_RECORDING) {
      const audioUri = await stopAudioRecording();
      this.setState({
        isRecording: false,
        currentStep: DriveSessionStep.UNIVERSAL_HELP_ROUTER_REASONING,
        statusMessage: 'Routing intent & extracting slots with Llama 3.2...',
      });

      const spokenIntent = await localWhisperService.transcribeAudioFile(audioUri || '', 'Universal Intent Response');

      if (!spokenIntent || spokenIntent.trim().length === 0) {
        const handled = await this.handleMissedAnswer(current, async () => {
          const defaultWf = DEFAULT_WORKFLOW_TEMPLATES[0];
          console.log(`[VoiceStateMachine] Defaulting to "${defaultWf.name}" after silence.`);
          this.setActiveWorkflow(defaultWf);
          await this.executeWorkflowStepAtIndex(0);
        });
        if (handled) return;
      }

      if (this.isStopKeyword(spokenIntent)) {
        await this.promptCancelConfirmation(current);
        return;
      }

      const matchedWorkflow = localLlamaEngine.classifyWorkflowIntent(spokenIntent, DEFAULT_WORKFLOW_TEMPLATES);
      console.log(`[VoiceStateMachine] Routed to workflow: ${matchedWorkflow.name}`);
      this.setActiveWorkflow(matchedWorkflow);

      // Perform One-Shot Slot Extraction on the initial utterance
      const oneShot = localLlamaEngine.extractOneShotSlots(spokenIntent, matchedWorkflow);
      console.log('[VoiceStateMachine] One-shot extracted slots:', oneShot);

      const existingResults = { ...this.state.workflowResults, ...oneShot.slots };
      this.setState({
        workflowResults: existingResults,
        rawTranscriptText: oneShot.summary || this.state.rawTranscriptText,
        actionItemsText: oneShot.actionItems || this.state.actionItemsText,
      });

      // Start dynamic workflow steps (will fast-path / skip any slots already extracted)
      await this.executeWorkflowStepAtIndex(0);

    // --- PHASE 3: DYNAMIC WORKFLOW STEP HANDLER (GUIDED FALLBACK) ---
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

      // Handle empty / missed speech on step
      if (!rawTranscript || rawTranscript.trim().length === 0) {
        // If this is an optional step, skip immediately without stalling driver
        if (!stepDef.required) {
          console.log(`[VoiceStateMachine] ⚡ Optional step "${stepDef.name}" left empty. Skipping cleanly.`);
          await this.executeWorkflowStepAtIndex(this.state.currentStepIndex + 1);
          return;
        }

        // If required step:
        const handled = await this.handleMissedAnswer(current, async () => {
          const placeholder = stepDef.placeholderFallback || 'Observation recorded.';
          this.recordStepResult(stepDef.id, placeholder);
          await this.executeWorkflowStepAtIndex(this.state.currentStepIndex + 1);
        });
        if (handled) return;
      }

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
   * Prompts the Universal Intent Router: "How can I help you today?" or "Project {name} found, how can I help you today?"
   */
  private async promptUniversalHelpRouter(customPrompt?: string): Promise<void> {
    const isExistingMatched = !this.state.isNewProject && (this.state.projectStatus === 'MATCHED' || Boolean(this.state.matchedProjectId));
    const projectName = this.state.projectNameText || 'Project';

    if (customPrompt) {
      this.currentPromptText = customPrompt;
    } else if (isExistingMatched) {
      this.currentPromptText = `Project ${projectName} found, how can I help you today?`;
    } else {
      this.currentPromptText = "How can I help you today?";
    }

    this.stepRetryCount = 0;

    this.setState({
      currentStep: DriveSessionStep.UNIVERSAL_HELP_ROUTER_PROMPT,
      isSpeaking: true,
      statusMessage: isExistingMatched
        ? `Project "${projectName}" found. Asking: "${this.currentPromptText}"...`
        : 'Project saved. Asking: "How can I help you today?"...',
    });

    await speakPrompt(this.currentPromptText, () => {
      this.beginRecordingStep(DriveSessionStep.UNIVERSAL_HELP_ROUTER_RECORDING);
    });
  }

  /**
   * Executes dynamic workflow step by index with One-Shot Fast Path skipping
   */
  private async executeWorkflowStepAtIndex(index: number): Promise<void> {
    const workflow = this.state.activeWorkflow;
    if (index >= workflow.steps.length) {
      await this.completeWorkflowExecution();
      return;
    }

    const step = workflow.steps[index];

    // Check if this step was already populated by One-Shot extraction!
    const existingVal = this.state.workflowResults[step.id];
    if (existingVal !== undefined && existingVal !== null && String(existingVal).trim().length > 0) {
      console.log(`[VoiceStateMachine] ⚡ One-Shot Fast Path: Step "${step.name}" already filled with "${existingVal}". Skipping prompt.`);
      this.setState({ currentStepIndex: index });
      await this.executeWorkflowStepAtIndex(index + 1);
      return;
    }

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
   * Complete Workflow & Save to SQLite / Firestore
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

    let finalProjectId = this.state.matchedProjectId;

    // Atomically commit new project to SQLite & Firestore on complete session ONLY
    if (this.state.isNewProject && this.state.projectNameText) {
      const projectName = this.state.projectNameText;
      const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      finalProjectId = newProjectId;

      let isSynced = 0;
      if (!firebaseSyncManager.isSimulatedOffline()) {
        const res = await firestoreService.saveProjectToFirestore({
          id: newProjectId,
          name: projectName,
          created_at: new Date().toISOString(),
          synced: 0,
          latitude: this.state.locationData?.latitude,
          longitude: this.state.locationData?.longitude,
          address: this.state.locationData?.address,
        });
        if (res.success) isSynced = 1;
      }

      await sqliteQueueService.createLocalProject(
        projectName,
        {
          latitude: this.state.locationData?.latitude,
          longitude: this.state.locationData?.longitude,
          address: this.state.locationData?.address,
        },
        isSynced
      );
      console.log(`[VoiceStateMachine] Atomically created new project "${projectName}" (${newProjectId}) on complete.`);
    }

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
      matched_project_id: finalProjectId,
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
      statusMessage: `${workflow.name} saved successfully`,
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
    this.isAdvancing = false;
    localWhisperService.setOnInterimTranscript(null);
    this.clearNoSpeechTimeout();
    this.stepRetryCount = 0;
    this.previousStepBeforeCancel = null;
    this.candidateFuzzyProject = undefined;
    this.originalSpokenProjectName = undefined;
    await stopSpeech();
    await cancelAudioRecording();
    await releaseAudioFocus();
    this.setState(this.getInitialState());
    wakeWordService.startListening();
  }
}

export const voiceStateMachine = new VoiceStateMachine();
