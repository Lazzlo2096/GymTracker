"""OAuth provider clients (Google / VK / Yandex)."""

from typing import Literal

import httpx
from fastapi import HTTPException

from project_config import settings

OAuthProvider = Literal["google", "vk", "yandex"]


def _cfg(provider: OAuthProvider) -> tuple[str, str, str]:
    if provider == "google":
        return (
            settings.GOOGLE_OAUTH_CLIENT_ID,
            settings.GOOGLE_OAUTH_CLIENT_SECRET,
            settings.GOOGLE_OAUTH_DEFAULT_REDIRECT_URI,
        )
    if provider == "vk":
        return (
            settings.VK_OAUTH_CLIENT_ID,
            settings.VK_OAUTH_CLIENT_SECRET,
            settings.VK_OAUTH_DEFAULT_REDIRECT_URI,
        )
    return (
        settings.YANDEX_OAUTH_CLIENT_ID,
        settings.YANDEX_OAUTH_CLIENT_SECRET,
        settings.YANDEX_OAUTH_DEFAULT_REDIRECT_URI,
    )


def build_auth_url(
    provider: OAuthProvider, redirect_uri: str | None, state: str | None
) -> str:
    client_id, _, default_redirect = _cfg(provider)
    if not client_id:
        raise HTTPException(
            status_code=500, detail=f"{provider}: client_id не настроен"
        )

    redir = (redirect_uri or default_redirect).strip()
    if not redir:
        raise HTTPException(status_code=400, detail="redirect_uri обязателен")

    if provider == "google":
        params = {
            "client_id": client_id,
            "redirect_uri": redir,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
        }
        if state:
            params["state"] = state
        return str(
            httpx.URL("https://accounts.google.com/o/oauth2/v2/auth", params=params)
        )

    if provider == "vk":
        params = {
            "client_id": client_id,
            "redirect_uri": redir,
            "response_type": "code",
            "scope": "email",
            "v": "5.131",
        }
        if state:
            params["state"] = state
        return str(httpx.URL("https://oauth.vk.com/authorize", params=params))

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redir,
    }
    if state:
        params["state"] = state

    return str(httpx.URL("https://oauth.yandex.ru/authorize", params=params))


async def exchange_code_and_get_identity(
    provider: OAuthProvider,
    *,
    code: str,
    redirect_uri: str | None,
) -> dict:
    client_id, client_secret, default_redirect = _cfg(provider)
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500, detail=f"{provider}: OAuth credentials не настроены"
        )

    redir = (redirect_uri or default_redirect).strip()
    if not redir:
        raise HTTPException(status_code=400, detail="redirect_uri обязателен")

    async with httpx.AsyncClient(timeout=20.0) as client:
        if provider == "google":
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redir,
                },
            )

            if token_resp.status_code >= 400:
                raise HTTPException(
                    status_code=400, detail="Google OAuth: не удалось обменять code"
                )

            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=400, detail="Google OAuth: access_token отсутствует"
                )

            user_resp = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if user_resp.status_code >= 400:
                raise HTTPException(
                    status_code=400, detail="Google OAuth: не удалось получить профиль"
                )

            profile = user_resp.json()
            return {
                "provider": "google",
                "provider_uid": str(profile.get("sub") or ""),
                "email": profile.get("email"),
                "display_name": profile.get("name") or profile.get("given_name"),
            }

        if provider == "vk":
            token_resp = await client.get(
                "https://oauth.vk.com/access_token",
                params={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redir,
                    "code": code,
                },
            )

            if token_resp.status_code >= 400:
                raise HTTPException(
                    status_code=400, detail="VK OAuth: не удалось обменять code"
                )

            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            vk_user_id = token_data.get("user_id")
            if not access_token or not vk_user_id:
                raise HTTPException(
                    status_code=400, detail="VK OAuth: access_token/user_id отсутствует"
                )

            profile_resp = await client.get(
                "https://api.vk.com/method/users.get",
                params={
                    "user_ids": vk_user_id,
                    "fields": "screen_name,first_name,last_name",
                    "v": "5.131",
                    "access_token": access_token,
                },
            )

            if profile_resp.status_code >= 400:
                raise HTTPException(
                    status_code=400, detail="VK OAuth: не удалось получить профиль"
                )

            profile_data = profile_resp.json()
            rows = profile_data.get("response") or []
            row = rows[0] if rows else {}

            display_name = " ".join(
                [p for p in [row.get("first_name"), row.get("last_name")] if p]
            ).strip() or row.get("screen_name")

            return {
                "provider": "vk",
                "provider_uid": str(vk_user_id),
                "email": token_data.get("email"),
                "display_name": display_name,
            }

        token_resp = await client.post(
            "https://oauth.yandex.ru/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_resp.status_code >= 400:
            raise HTTPException(
                status_code=400, detail="Yandex OAuth: не удалось обменять code"
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(
                status_code=400, detail="Yandex OAuth: access_token отсутствует"
            )

        profile_resp = await client.get(
            "https://login.yandex.ru/info",
            params={"format": "json"},
            headers={"Authorization": f"OAuth {access_token}"},
        )

        if profile_resp.status_code >= 400:
            raise HTTPException(
                status_code=400, detail="Yandex OAuth: не удалось получить профиль"
            )

        profile = profile_resp.json()
        return {
            "provider": "yandex",
            "provider_uid": str(profile.get("id") or ""),
            "email": profile.get("default_email"),
            "display_name": profile.get("real_name")
            or profile.get("display_name")
            or profile.get("login"),
        }
