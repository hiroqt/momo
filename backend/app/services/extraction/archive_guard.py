"""Bound Office (OOXML) archives before any XML parser opens their members."""

import io
import zipfile

MAX_MEMBERS = 5000
MAX_EXPANDED_BYTES = 100 * 1024 * 1024


def validate_office_archive(data: bytes, expected_member: str) -> None:
    """Reject corrupt, encrypted, wrong-type or expansion-abusive archives.

    zipfile reads at most each member's declared size, so bounding declared sizes
    also bounds the bytes a downstream parser can decompress.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
            names = {member.filename for member in members}
    except (zipfile.BadZipFile, zipfile.LargeZipFile, ValueError, OSError, EOFError):
        raise ValueError("The Office document is corrupt") from None
    if not members or len(members) > MAX_MEMBERS:
        raise ValueError("The Office document has an unsupported structure")
    if any(member.flag_bits & 0x1 for member in members):
        raise ValueError("Encrypted documents are unsupported")
    if sum(member.file_size for member in members) > MAX_EXPANDED_BYTES:
        raise ValueError("The Office document expands beyond the allowed size")
    if expected_member not in names or "[Content_Types].xml" not in names:
        raise ValueError("The Office document is not the declared type")
