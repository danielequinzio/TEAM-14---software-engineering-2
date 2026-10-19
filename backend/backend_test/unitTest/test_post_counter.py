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

def linked_services(session, counter_id):
    """Servizi collegati a uno sportello, letti direttamente dal DB di test."""
    rows = session.exec(
        select(Counter_Service.service_id).where(
            Counter_Service.counter_id == counter_id
        )
    ).all()
    return sorted(rows)

# --------- Tests ----------

def test_create_counter(client, mock_session):

    response = client.post("/counters", params={"name": "Counter 1"}, json=[1, 2])

    assert response.status_code == 201
    assert response.json() == {"id": 1, "name": "Counter 1"}
    assert linked_services(mock_session, 1) == [1, 2]

    assert mock_session.get(Counter, 1) is not None


def test_create_counter_deduplicates_service_ids(client, mock_session):
    client.post("/counters", params={"name": "Counter 1"}, json=[2, 2, 1])

    assert linked_services(mock_session, 1) == [1, 2]


def test_create_counter_without_services(client, mock_session):
    response = client.post("/counters", params={"name": "Counter 1"}, json=[])

    assert response.status_code == 201
    assert linked_services(mock_session, 1) == []


def test_create_counter_unknown_service_returns_422_and_creates_nothing(client, mock_session):
    response = client.post("/counters", params={"name": "Counter 1"}, json=[1, 99])

    assert response.status_code == 422
    assert client.get("/counters").json() == []
    assert mock_session.exec(select(Counter)).all() == []


def test_create_counter_missing_name_returns_422(client, mock_session):
    response = client.post("/counters", json=[1])

    assert response.status_code == 422
    assert mock_session.exec(select(Counter)).all() == []


def test_create_counter_duplicate_name_returns_409_and_creates_nothing(client, mock_session):
    client.post("/counters", params={"name": "Counter 1"}, json=[1])

    response = client.post("/counters", params={"name": "Counter 1"}, json=[2])

    assert response.status_code == 409
    assert len(mock_session.exec(select(Counter)).all()) == 1


def test_create_counter_empty_name_returns_422(client, mock_session):
    response = client.post("/counters", params={"name": ""}, json=[1])

    assert response.status_code == 422
    assert mock_session.exec(select(Counter)).all() == []
