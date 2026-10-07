# Backend

FastAPI + SQLModel API for the Office Queue Management service. Data is stored in a local SQLite database (`OQM.db`), created automatically on startup.

Requires Python 3.10 or newer.

## Windows

Open a terminal in `backend`, then run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
fastapi dev API/API.py
```

## Unix / macOS

Open a terminal in `backend`, then run:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
fastapi dev API/API.py
```

The first four commands are needed only once. Next time, just activate the virtual environment and start the server:

```bash
source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1
fastapi dev API/API.py
```

## Using the API

The backend starts on:

```text
http://localhost:8000
```

The Swagger UI (interactive docs, where every endpoint can be tried) is available at:

```text
http://localhost:8000/docs
```

`fastapi dev` restarts the server automatically when a file is saved. Stop it with `Ctrl+C`.
To run without auto-reload, use `fastapi run API/API.py` instead.

## Adding a dependency

Install the package, then add it to `requirements.txt` so the rest of the team gets it too:

```bash
python -m pip install <package>
```