from __future__ import annotations

import json
import logging
from typing import Any, Optional
from urllib.parse import quote

import aiohttp

logger = logging.getLogger("voicecart.tools")


class StoreClient:
    def __init__(self, base_url: str, sid: str, secret: str, http: aiohttp.ClientSession | None = None):
        self.base_url = base_url.rstrip("/")
        self.sid = sid
        self.secret = secret
        self._http = http
        self._owned = http is None

    async def session(self) -> aiohttp.ClientSession:
        if self._http is None or self._http.closed:
            self._http = aiohttp.ClientSession()
            self._owned = True
        return self._http

    async def aclose(self) -> None:
        if self._owned and self._http is not None and not self._http.closed:
            await self._http.close()

    def _headers(self) -> dict[str, str]:
        return {"Content-Type": "application/json", "x-agent-secret": self.secret}

    async def _request(self, method: str, path: str, **kwargs: Any) -> str:
        url = f"{self.base_url}{path}"
        try:
            http = await self.session()
            async with http.request(method, url, headers=self._headers(), timeout=aiohttp.ClientTimeout(total=15), **kwargs) as res:
                text = await res.text()
                if res.status >= 400:
                    try:
                        data = json.loads(text)
                        return json.dumps({"ok": False, "error": data.get("error") or text})
                    except json.JSONDecodeError:
                        return json.dumps({"ok": False, "error": f"Store returned {res.status}."})
                return text
        except Exception as exc:
            logger.exception("store call failed %s %s", method, path)
            return json.dumps({"ok": False, "error": f"I could not reach the shop just now. {exc}"})

    async def search(self, query: str) -> str:
        return await self._request("GET", f"/api/products?q={quote(query)}")

    async def describe(self, product_id: str) -> str:
        return await self._request("GET", f"/api/products/{quote(product_id)}")

    async def options(self, product_id: str) -> str:
        return await self._request("GET", f"/api/products/{quote(product_id)}/options")

    async def add(self, product_id: str, quantity: int, size: Optional[str], color: Optional[str]) -> str:
        payload = {
            "sid": self.sid,
            "productId": product_id,
            "quantity": quantity,
        }
        if size:
            payload["size"] = size
        if color:
            payload["color"] = color
        return await self._request("POST", "/api/cart/add", json=payload)

    async def remove(self, sku: str) -> str:
        return await self._request("POST", "/api/cart/remove", json={"sid": self.sid, "sku": sku})

    async def cart(self) -> str:
        return await self._request("GET", f"/api/cart?sid={quote(self.sid)}")

    async def save_address(
        self,
        spoken: str,
        house: Optional[str],
        area: Optional[str],
        city: Optional[str],
        pincode: Optional[str],
        phone: Optional[str],
        landmark: Optional[str],
    ) -> str:
        payload: dict[str, Any] = {"sid": self.sid, "spoken": spoken}
        if house:
            payload["house"] = house
        if area:
            payload["area"] = area
        if city:
            payload["city"] = city
        if pincode:
            payload["pincode"] = pincode
        if phone:
            payload["phone"] = phone
        if landmark:
            payload["landmark"] = landmark
        return await self._request("POST", "/api/cart/address", json=payload)

    async def collect_digits(self, spoken: str, field: Optional[str] = None) -> str:
        payload: dict[str, Any] = {"sid": self.sid, "spoken": spoken}
        if field:
            payload["field"] = field
        return await self._request("POST", "/api/cart/digits", json=payload)

    async def checkout(self) -> str:
        return await self._request("POST", "/api/checkout", json={"sid": self.sid})

    async def post_telemetry(self, turn: dict[str, Any]) -> None:
        try:
            await self._request("POST", "/api/telemetry", json={"sid": self.sid, "turn": turn})
        except Exception:
            logger.exception("telemetry post failed")
