from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import upload, notes, health, auth, projects, inventory, invoices

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs"
)

# Enable CORS for Next.js dashboard & mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(upload.router, prefix=settings.API_PREFIX)
app.include_router(notes.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(projects.router, prefix=settings.API_PREFIX)
app.include_router(inventory.router, prefix=settings.API_PREFIX)
app.include_router(invoices.router, prefix=settings.API_PREFIX)

@app.get("/")
async def root():
    return {
        "message": "Welcome to SmartTradie Tradie Business Management & Voice Note API",
        "docs": f"{settings.API_PREFIX}/docs",
        "health": f"{settings.API_PREFIX}/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
