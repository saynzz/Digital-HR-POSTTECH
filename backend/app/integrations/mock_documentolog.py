import uuid


class MockDocumentologAdapter:
    _docs: dict[str, str] = {}

    def create_document(self, kind: str, employee_external_id: str, payload: dict) -> str:
        doc_id = f"DOC-{uuid.uuid4().hex[:10].upper()}"
        self._docs[doc_id] = "registered"
        return doc_id

    def get_document_status(self, doc_id: str) -> str:
        return self._docs.get(doc_id, "unknown")
