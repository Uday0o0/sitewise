"""TF-IDF based document retrieval service with project boundary isolation.

Uses scikit-learn's TfidfVectorizer for term-frequency weighting and
cosine similarity for ranking. No external API dependencies.
Supports persistence across sessions by loading from SQLite.
"""

from __future__ import annotations
import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


class RetrievalResult:
    """A single retrieved chunk with relevance score and metadata."""

    __slots__ = (
        "document_id",
        "document_title",
        "chunk_index",
        "content",
        "score",
        "word_count",
        "page_number",
        "project_id",
    )

    def __init__(
        self,
        document_id: str,
        document_title: str,
        chunk_index: int,
        content: str,
        score: float,
        word_count: int = 0,
        page_number: Optional[int] = None,
        project_id: str = "",
    ):
        self.document_id = document_id
        self.document_title = document_title
        self.chunk_index = chunk_index
        self.content = content
        self.score = score
        self.word_count = word_count
        self.page_number = page_number
        self.project_id = project_id

    def to_dict(self) -> dict:
        return {
            "documentId": self.document_id,
            "documentTitle": self.document_title,
            "chunkIndex": self.chunk_index,
            "content": self.content,
            "score": round(self.score, 4),
            "wordCount": self.word_count,
            "pageNumber": self.page_number,
            "projectId": self.project_id,
        }


class DocumentIndex:
    """In-memory TF-IDF index over document chunks with project isolation."""

    def __init__(self):
        # List of dicts: {document_id, document_title, project_id, chunk_index, content, word_count, page_number}
        self._chunks: list[dict] = []
        self._vectorizer: Optional[object] = None
        self._tfidf_matrix = None
        self._is_fitted = False

    @property
    def chunk_count(self) -> int:
        return len(self._chunks)

    def clear(self) -> None:
        """Clear all indexed chunks."""
        self._chunks = []
        self._vectorizer = None
        self._tfidf_matrix = None
        self._is_fitted = False

    def add_chunks(
        self,
        document_id: str,
        document_title: str,
        project_id: str,
        chunks: list[dict],
    ) -> None:
        """Add chunks from a document to the index.

        Args:
            document_id: Unique document identifier
            document_title: Human-readable document title
            project_id: Project scope
            chunks: List of chunk dicts with 'index', 'content', 'word_count', optional 'page_number'
        """
        # Remove any existing chunks for this document first (avoid duplicates)
        self._chunks = [c for c in self._chunks if c["document_id"] != document_id]

        for chunk in chunks:
            self._chunks.append({
                "document_id": document_id,
                "document_title": document_title,
                "project_id": project_id,
                "chunk_index": chunk.get("index", 0),
                "content": chunk.get("content", ""),
                "word_count": chunk.get("word_count", 0),
                "page_number": chunk.get("page_number"),
            })
        self._is_fitted = False

    def remove_document(self, document_id: str) -> int:
        """Remove all chunks for a document. Returns count removed."""
        before = len(self._chunks)
        self._chunks = [c for c in self._chunks if c["document_id"] != document_id]
        removed = before - len(self._chunks)
        if removed > 0:
            self._is_fitted = False
        return removed

    async def sync_from_db(self, db: AsyncSession, project_id: Optional[str] = None) -> int:
        """Synchronize in-memory index from SQLite database.

        Ensures indexed passages persist across database sessions and backend restarts.
        """
        from models import Document, DocumentPassage

        query = select(DocumentPassage, Document).join(Document, DocumentPassage.document_id == Document.id)
        if project_id:
            query = query.where(Document.project_id == project_id)
        query = query.where(Document.processing_status == "READY")

        result = await db.execute(query)
        rows = result.all()

        if project_id:
            # Clear existing chunks for this project only
            self._chunks = [c for c in self._chunks if c["project_id"] != project_id]
        else:
            self._chunks = []

        for passage, doc in rows:
            self._chunks.append({
                "document_id": doc.id,
                "document_title": doc.title,
                "project_id": doc.project_id,
                "chunk_index": passage.passage_index,
                "content": passage.content,
                "word_count": passage.word_count,
                "page_number": passage.page_number,
            })

        self._is_fitted = False
        return len(rows)

    def _build_index_for_corpus(self, corpus_chunks: list[dict]):
        """Fit vectorizer for a specific chunk subset."""
        if not corpus_chunks:
            return None, None

        if not HAS_SKLEARN:
            return None, None

        texts = [c["content"] for c in corpus_chunks]
        vectorizer = TfidfVectorizer(
            max_features=10000,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
            max_df=1.0,
            sublinear_tf=True,
        )
        try:
            tfidf_matrix = vectorizer.fit_transform(texts)
            return vectorizer, tfidf_matrix
        except Exception:
            return None, None

    def search(
        self,
        query: str,
        project_id: Optional[str] = None,
        top_k: int = 5,
        min_score: float = 0.01,
    ) -> list[RetrievalResult]:
        """Search the index for chunks most relevant to the query.
        Guarantees strict project boundary isolation if project_id is provided.

        Args:
            query: Natural language query
            project_id: Optional project filter
            top_k: Maximum number of results
            min_score: Minimum relevance score threshold

        Returns:
            List of RetrievalResult sorted by descending relevance
        """
        # Filter chunks by project if requested
        candidate_chunks = (
            [c for c in self._chunks if c["project_id"] == project_id]
            if project_id
            else self._chunks
        )

        if not candidate_chunks:
            return []

        if HAS_SKLEARN:
            vectorizer, tfidf_matrix = self._build_index_for_corpus(candidate_chunks)
            if vectorizer is not None and tfidf_matrix is not None:
                return self._search_tfidf(query, candidate_chunks, vectorizer, tfidf_matrix, top_k, min_score)

        return self._search_keyword(query, candidate_chunks, top_k, min_score)

    def _search_tfidf(
        self,
        query: str,
        chunks: list[dict],
        vectorizer,
        tfidf_matrix,
        top_k: int,
        min_score: float,
    ) -> list[RetrievalResult]:
        """TF-IDF + cosine similarity search over given chunks."""
        try:
            query_vec = vectorizer.transform([query])
            similarities = cosine_similarity(query_vec, tfidf_matrix).flatten()
        except Exception:
            return self._search_keyword(query, chunks, top_k, min_score)

        scored = []
        for idx, score in enumerate(similarities):
            if score >= min_score:
                scored.append((idx, float(score)))

        scored.sort(key=lambda x: x[1], reverse=True)
        scored = scored[:top_k]

        results = []
        for idx, score in scored:
            chunk = chunks[idx]
            results.append(RetrievalResult(
                document_id=chunk["document_id"],
                document_title=chunk["document_title"],
                chunk_index=chunk["chunk_index"],
                content=chunk["content"],
                score=score,
                word_count=chunk["word_count"],
                page_number=chunk.get("page_number"),
                project_id=chunk["project_id"],
            ))

        return results

    def _search_keyword(
        self,
        query: str,
        chunks: list[dict],
        top_k: int,
        min_score: float,
    ) -> list[RetrievalResult]:
        """Fallback keyword-based search."""
        query_terms = set(re.findall(r"\w+", query.lower()))
        if not query_terms:
            return []

        scored = []
        for idx, chunk in enumerate(chunks):
            content_lower = chunk["content"].lower()
            content_terms = set(re.findall(r"\w+", content_lower))

            if not content_terms:
                continue

            overlap = len(query_terms & content_terms)
            score = overlap / max(len(query_terms), 1)

            if query.lower() in content_lower:
                score += 0.5

            if score >= min_score:
                scored.append((idx, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        scored = scored[:top_k]

        results = []
        for idx, score in scored:
            chunk = chunks[idx]
            results.append(RetrievalResult(
                document_id=chunk["document_id"],
                document_title=chunk["document_title"],
                chunk_index=chunk["chunk_index"],
                content=chunk["content"],
                score=min(score, 1.0),
                word_count=chunk["word_count"],
                page_number=chunk.get("page_number"),
                project_id=chunk["project_id"],
            ))

        return results


# Global index singleton
_global_index = DocumentIndex()


def get_index() -> DocumentIndex:
    """Get the global document index singleton."""
    return _global_index
