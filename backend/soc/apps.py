from django.apps import AppConfig


class SocConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "soc"

    def ready(self) -> None:
        import soc.signals  # noqa: F401
