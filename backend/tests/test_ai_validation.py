from app.ai import valid_citations


def test_valid_when_all_cited_chunks_are_allowed():
    assert valid_citations([1, 2], {1, 2, 3})


def test_invalid_when_citing_unknown_chunk():
    assert not valid_citations([1, 99], {1, 2, 3})


def test_invalid_when_no_citations_at_all():
    assert not valid_citations([], {1, 2, 3})


def test_duplicate_citations_still_valid():
    assert valid_citations([2, 2], {1, 2})
