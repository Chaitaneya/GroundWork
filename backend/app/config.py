from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, loaded from environment variables / backend/.env.

    pydantic-settings matches env vars to fields case-insensitively:
    DATABASE_URL in .env fills `database_url` here.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]

    # Signs JWTs — anyone holding this key can mint valid logins.
    secret_key: str = "dev-only-insecure-secret"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Gemini (Phase 4). Empty key = AI features cleanly disabled.
    gemini_api_key: str = ""
    # Optional second key: used automatically when the primary hits
    # rate limits / quota (429, 503, RESOURCE_EXHAUSTED).
    gemini_api_key_fallback: str = ""
    # "-latest" alias: tracks the current flash model so retired model names
    # (like gemini-2.5-flash, which broke us once) can't strand the app.
    gemini_model: str = "gemini-flash-latest"
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768  # changing this means re-embedding every chunk


settings = Settings()
