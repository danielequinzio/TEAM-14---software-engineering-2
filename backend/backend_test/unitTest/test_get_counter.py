"""
Unit tests for POST /counters.

The real DB session is replaced with a MagicMock, so these tests never
touch OQM.db. Run from the backend folder with:

    pytest "backend_test" -v
"""
import sys
from pathlib import Path
from sqlmodel import Session, SQLModel, create_engine, select

import pytest
from fastapi.testclient import TestClient

# make backend/API importable (the test folder name has a space, so no package import)
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "API"))

from API import Counter, Service, Counter_Service, app, get_session  # noqa: E402


# ---------- Fixtures ----------

@pytest.fixture
def mock_session(tmp_path):
    """A temporary SQLite session used by the API dependency override."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Service(name="Shipping", service_time=5))
        session.add(Service(name="Accounts", service_time=10))
        session.add(Service(name="Deposits", service_time=7))
        session.commit()
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(mock_session):
    """TestClient whose get_session dependency yields the mock session."""
    app.dependency_overrides[get_session] = lambda: mock_session
    # not used as a context manager -> lifespan (create_all / seeding) doesn't run
    yield TestClient(app)
    app.dependency_overrides.clear()

def make_counter(client, name="Counter 1", service_ids=(1,)):
    response = client.post("/counters", params={"name": name}, json=list(service_ids))
    assert response.status_code == 201
    return response.json()

# --------- Tests ----------

def test_list_counters_empty(client):
    response = client.get("/counters")

    assert response.status_code == 200
    assert response.json() == []


def test_list_counters(client):
    make_counter(client, "Counter 1", [1])
    make_counter(client, "Counter 2", [2, 3])

    response = client.get("/counters")

    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "Counter 1"},
        {"id": 2, "name": "Counter 2"},
    ]


def test_get_counter(client):
    make_counter(client, "Counter 1", [1])

    response = client.get("/counters/1")

    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Counter 1"}


def test_get_counter_not_found(client, mock_session):
    response = client.get("/counters/42")

    assert response.status_code == 404
    assert mock_session.get(Counter, 42) is None