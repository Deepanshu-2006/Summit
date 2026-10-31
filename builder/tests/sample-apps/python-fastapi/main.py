import os
from fastapi import FastAPI

app = FastAPI(title="Summit FastAPI Sample")

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "framework": "fastapi",
        "service": "python-fastapi"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
