from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Jana Hub API"
    database_url: str = "sqlite:///./janamen.db"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    seed_on_startup: bool = True
    reset_db_on_schema_change: bool = True

    company_name: str = "ТОО «Jana Post»"

    hr_system_provider: str = "mock"
    zup_url: str = ""
    zup_user: str = ""
    zup_password: str = ""
    zup_field_map: str = ""
    zup_timeout: float = 30.0
    zup_verify_tls: bool = True
    docflow_provider: str = "mock"
    mail_provider: str = "auto"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_ssl: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = ""
    mail_from_name: str = "Jana Hub · Jana Post"

    app_base_url: str = "http://localhost:5173"
    invite_ttl_hours: int = 72
    expose_invite_links: bool = True

    assistant_min_score: float = 0.4
    llm_provider: str = "none"
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:3b"
    llm_timeout: float = 120.0


settings = Settings()
