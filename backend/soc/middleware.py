from __future__ import annotations

import threading

from django.http import HttpRequest, HttpResponse

_thread_locals = threading.local()


def set_current_user(user) -> None:
    _thread_locals.user = user


def get_current_user():
    return getattr(_thread_locals, "user", None)


class CurrentUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        set_current_user(getattr(request, "user", None))
        response = self.get_response(request)
        set_current_user(None)
        return response
