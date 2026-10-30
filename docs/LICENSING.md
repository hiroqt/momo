# Project licensing

This page compares three standard open-source licenses for the Momo source
code. It is a decision aid, not legal advice. **No project-wide license has
been selected or applied yet.** Until the copyright holder chooses one and the
repository includes its complete license text, this page does not grant a
license to use or redistribute the project.

## Options

| License | Practical effect | Choose it when |
| --- | --- | --- |
| [MIT](https://opensource.org/license/mit) (`MIT`) | Permissive. Redistribution and modified works are allowed with the copyright and permission notice preserved. It does not include an express patent grant. | A short, familiar license with minimal conditions is the priority. |
| [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) (`Apache-2.0`) | Permissive. Requires preserving notices and marking changed files; includes an express contributor patent license and patent-litigation termination clause. Preserve applicable `NOTICE` attributions when distributing. | Broad reuse is desired and explicit patent terms and attribution handling are useful. |
| [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/) (`MPL-2.0`) | File-level copyleft. Distributed modifications to MPL-covered files must remain available under MPL; separate files in a larger work may use other terms, subject to the license. | Reuse is allowed, while changes to covered files should stay shareable. |

These summaries are not substitutes for reading the license texts. The
[Mozilla FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) explains MPL's
file-level scope; the [Apache application guide](https://www.apache.org/legal/apply-license)
covers notices and applying Apache-2.0.

## Applying a choice

After the copyright holder selects a license:

1. Add its complete canonical text as the root `LICENSE` file and use the
   correct SPDX identifier (`MIT`, `Apache-2.0`, or `MPL-2.0`) in repository
   metadata where supported.
2. Add the required copyright and license notices. For Apache-2.0, preserve
   relevant third-party attribution in `NOTICE` when applicable. For MPL-2.0,
   attach the license notice to covered files as required by the license.
3. Inventory bundled assets, generated media, fonts, datasets, and dependencies
   separately. A root code license does not automatically relicense third-party
   material or user-uploaded study documents.
4. Check that the person or entity applying the license has authority over the
   copyright and contributions being licensed.

The repository currently has no root `LICENSE` file. This documentation change
does not claim that all dependencies or media have been audited; existing
asset-specific notices remain independently applicable.
