import os
import logging
import requests

logger = logging.getLogger(__name__)


def shorten_url(url: str) -> str:
    """Shorten a URL using the workshop URL shortener.

    Falls back to the original URL if shortening fails.
    """
    api_url = os.getenv("URL_SHORTENER_URL")

    if not api_url:
        logger.warning("URL_SHORTENER_URL not configured, returning original URL")
        return url

    try:
        logger.info("Shortening URL")
        response = requests.post(
            f"{api_url.rstrip('/')}/shorten",
            json={"url": url},
            headers={"Content-Type": "application/json"},
            timeout=5,
        )
        response.raise_for_status()

        data = response.json()
        short_code = data["short_code"]
        # Construct full shortened URL
        shortened = f"{api_url.rstrip('/')}/{short_code}"

        logger.info(f"Created shortened URL: {shortened}")
        return shortened

    except Exception as e:
        logger.warning(f"URL shortening failed: {e}, returning original URL")
        return url
