# Hugging Face Spaces & AI Resource Offloading Guide

This guide describes how to deploy the Kokoro TTS engine to a free Hugging Face Space to completely offload its PyTorch memory (1.6 GB) and CPU cycles from your 8GB VPS. It also outlines other AI services that can be offloaded there.

---

## 1. Deploying Kokoro TTS to Hugging Face Spaces (Free Tier)

Hugging Face Spaces provides a **CPU Basic** hardware tier that is **16 GB RAM / 2 vCPUs** and **100% free**. This is more than enough to host our Kokoro FastAPI container.

### Step-by-Step Deployment

1. **Sign Up / Log In:** Go to [huggingface.co](https://huggingface.co) and log in.
2. **Create Space:** Click on your profile picture in the top right $\rightarrow$ **New Space**.
3. **Configure Space Details:**
   - **Space Name:** `ixstats-kokoro` (or any name you prefer)
   - **License:** `mit` (or choose any)
   - **Select SDK:** Select **Docker** (very important).
   - **Docker Template:** Choose **Blank** (do not select template-specific configs).
   - **Space Hardware:** Select **CPU Basic (16GB RAM · 2 vCPUs · Free)**.
   - **Visibility:** **Public** (required for the Next.js API route to reach it; access is secured because the endpoint only handles pure text-to-speech synthesis).
4. **Create the files:** Once the Space is created, go to the **Files** tab and add a new file named `Dockerfile` with the following content:

   ```dockerfile
   FROM ghcr.io/remsky/kokoro-fastapi-cpu:latest

   # Set environment variables for optimized ONNX execution
   ENV ONNX_NUM_THREADS=2
   ENV ONNX_INTER_OP_THREADS=2
   ENV ONNX_EXECUTION_MODE=parallel
   ENV ONNX_OPTIMIZATION_LEVEL=all

   # Hugging Face Spaces expose traffic on port 7860
   EXPOSE 7860

   # Run FastAPI binding to port 7860
   ENTRYPOINT ["uvicorn", "api.src.main:app", "--host", "0.0.0.0", "--port", "7860"]
   ```

5. **Build and Deploy:** Commit the `Dockerfile`. Hugging Face will automatically trigger the build pipeline. Within 3-4 minutes, the Space will compile and display a live status showing **Running**.
6. **Retrieve API URL:** Click the **Embed this Space** button (represented by three dots `...` in the top right) $\rightarrow$ copy the **Direct URL** (it looks like `https://<username>-<space-name>.hf.space`).
7. **Wire into IxStates:**
   Connect to your database and update the configuration variables to point to the Space URL:
   ```sql
   UPDATE "SystemConfig" SET "value" = 'https://<username>-<space-name>.hf.space' WHERE "key" = 'onoma.kokoro.fastApiUrl';
   ```
   _Note: When the Space receives no traffic for 48 hours, it automatically pauses. The first query from a user will wake it up (takes ~15 seconds to boot). Our Next.js proxy route has a 60-second timeout, so it will wait for the container to wake up and synthesize successfully without throwing an error._

---

## 2. Other AI Workloads to Offload to Hugging Face Spaces

You can repeat the same process to offload other heavy machine learning tasks from your local VPS:

### A. Whisper (Speech-to-Text / Transcription)

- **Purpose:** Transcribe audio recordings or voice comments.
- **Why offload:** Running Whisper locally requires PyTorch and consumes ~1.5 GB RAM.
- **HF Space Recipe:** Choose **Docker** SDK and create a `Dockerfile`:
  ```dockerfile
  FROM ghcr.io/fedirz/faster-whisper-server:latest
  EXPOSE 7860
  ENTRYPOINT ["faster-whisper-server", "--host", "0.0.0.0", "--port", "7860", "--model", "base"]
  ```
  This serves a fully OpenAI-compatible transcription endpoint (`/v1/audio/transcriptions`) for free.

### B. LLM Inference (Llama 3 / Mistral)

- **Purpose:** Power chatbot assistants, political advisors, or document analysis.
- **Why offload:** Loading an 8B quantized model requires at least 5-6 GB of RAM, which would crash a 8GB VPS host.
- **HF Space Recipe:** Create a Space using **Docker** SDK targeting `llama.cpp`'s server:
  ```dockerfile
  FROM ghcr.io/ggerganov/llama.cpp:server
  # Pre-download a GGUF model into the container
  RUN wget https://huggingface.co/MaziyarPanahi/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf -O /model.gguf
  EXPOSE 7860
  ENTRYPOINT ["/server", "-m", "/model.gguf", "-c", "2048", "--host", "0.0.0.0", "--port", "7860"]
  ```
  This exposes a free, serverless OpenAI-compatible chat completion endpoint on 16GB RAM.

---

## 3. Safely Disabling & Removing Local AI Containers

Once your Hugging Face Space is configured and confirmed working via tests or live application logs, you can clean up the local Kokoro container to free up **1.6 GB of RAM** and **~2.2 GB of disk space**.

### Step 1: Verify the Database Configurations

Ensure the application points to the new Hugging Face Space URL in PostgreSQL:

```sql
-- Connect to database and verify key
SELECT key, value FROM "SystemConfig" WHERE key LIKE 'onoma.kokoro%';
```

Expected output should have:

- `onoma.kokoro.enabled` = `true`
- `onoma.kokoro.fastApiUrl` = `https://<your-username>-ixstats-kokoro.hf.space`

### Step 2: Stop and Remove the Local Container

Stop and delete the running container instance on the host:

```bash
docker stop ixstats-kokoro
docker rm ixstats-kokoro
```

### Step 3: Remove Kokoro from `docker-compose.yml`

Open `docker-compose.yml` and delete the `kokoro` service definition block completely (lines 58 to 85):

```yaml
# DELETE THIS ENTIRE BLOCK:
  kokoro:
    image: ghcr.io/remsky/kokoro-fastapi-cpu:latest
    container_name: ixstats-kokoro
    ...
```

### Step 4: Reclaim Local Disk Space

Delete the heavy PyTorch Docker image from the host system.

> [!CAUTION]
> As per project safety policies, never run a wildcard `docker system prune -a --volumes` to prevent deleting the persistent production Postgres database volume.
> Only remove the specific Kokoro image:

```bash
docker rmi ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

This completes the migration, keeping all model parameters and active CPU processing 100% off-server!
