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


settings = Settings()
