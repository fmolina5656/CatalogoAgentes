"""Azure Blob Storage con identidad administrada (sin llaves)."""
from __future__ import annotations

from azure.core import MatchConditions
from azure.core.exceptions import ResourceExistsError, ResourceModifiedError, ResourceNotFoundError
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings

from .base import Conflict, check_key


class BlobStore:
    def __init__(self, account_url: str, container: str):
        self.service = BlobServiceClient(account_url, credential=DefaultAzureCredential())
        self.container = self.service.get_container_client(container)
        try:
            self.container.create_container()
        except ResourceExistsError:
            pass

    def get(self, key):
        try:
            d = self.container.get_blob_client(check_key(key)).download_blob()
        except ResourceNotFoundError:
            return None
        return d.readall(), d.properties.etag

    def put(self, key, data, *, content_type, if_match=None, if_none_match=False):
        blob = self.container.get_blob_client(check_key(key))
        kwargs: dict = {"overwrite": True, "content_settings": ContentSettings(content_type=content_type)}
        if if_match is not None:
            kwargs.update(etag=if_match, match_condition=MatchConditions.IfNotModified)
        elif if_none_match:
            kwargs["overwrite"] = False
        try:
            r = blob.upload_blob(data, **kwargs)
        except (ResourceModifiedError, ResourceExistsError) as e:
            raise Conflict(key) from e
        except ResourceNotFoundError as e:  # if_match sobre algo que ya no existe
            raise Conflict(key) from e
        return r["etag"]

    def delete(self, key, *, if_match=None):
        blob = self.container.get_blob_client(check_key(key))
        kwargs: dict = {}
        if if_match is not None:
            kwargs.update(etag=if_match, match_condition=MatchConditions.IfNotModified)
        try:
            blob.delete_blob(**kwargs)
        except ResourceNotFoundError:
            return False
        except ResourceModifiedError as e:
            raise Conflict(key) from e
        return True

    def list(self, prefix):
        return sorted(b.name for b in self.container.list_blobs(name_starts_with=prefix))
