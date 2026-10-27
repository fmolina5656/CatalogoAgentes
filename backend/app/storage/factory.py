from __future__ import annotations

from ..config import Settings
from .base import Store


def make_store(s: Settings) -> Store:
    if s.storage == "blob":
        from .blob import BlobStore

        if not s.blob_account_url:
            raise RuntimeError("STORAGE=blob requiere AZURE_STORAGE_ACCOUNT_URL")
        return BlobStore(s.blob_account_url, s.blob_container)
    from .local import LocalStore

    return LocalStore(s.data_dir)
