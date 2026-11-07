# Skills externas incorporadas (vendored)

Copiadas y revisadas a mano, fijadas a un commit concreto. No se actualizan solas:
para actualizar, repetir la revisión y cambiar el SHA aquí.

| Carpeta | Origen | Commit | Licencia | Cambios locales |
|---|---|---|---|---|
| `karpathy-guidelines` | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | `2c606141936f1eeef17fa3043a72095b4765b9c2` | MIT (declarada en el SKILL.md) | Ninguno |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (`.claude/skills/ui-ux-pro-max`) | `0da327f37b436c173ce51177678b65ca92e6f3f7` | MIT | Solo esta skill; no se incluyen `design`, `brand`, `banner-design`, `slides`, `ui-styling` ni `design-system` (algunas llaman a APIs externas de pago) |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`skills/taste-skill`) | `f6b76575f949707b4e3c37cd86cb44b0b98643e8` | MIT | **Eliminado el hook `Stop` automático** (lanzaba Node + Chrome al final de cada turno). Su verificador `scripts/gate.mjs` se puede ejecutar a mano |
| `mp-*` (10 skills) | [mattpocock/skills](https://github.com/mattpocock/skills) | `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d` | MIT (ver `mp-codebase-design/LICENSE-mattpocock`) | Renombradas con prefijo `mp-` para no chocar con skills de Superpowers o integradas; quitadas las carpetas `agents/` (config de otros asistentes) |

Skills de Matt Pocock incluidas: `codebase-design`, `domain-modeling`, `improve-codebase-architecture`,
`diagnosing-bugs`, `to-spec`, `implement-spec`, `research`, `grill-me`, `handoff`, `writing-for-agents`.
Descartadas: las de `in-progress/`, `misc/`, `setup-*`, `wizard` (ejecuta scripts) y `code-review`/`tdd`
(duplican skills ya disponibles).

## Revisión de seguridad (2026-11-07)

- Sin hooks activos en ninguna skill incorporada.
- Sin claves ni tokens embebidos.
- `ui-ux-pro-max/scripts`: búsqueda local en CSV/JSON (Python), sin red.
- `design-taste-frontend/scripts`: utilidades locales; `icons.mjs` y `photos.mjs` descargan iconos y
  fotos libres de CDNs públicos (jsDelivr, Wikimedia Commons, picsum.photos; Google Fonts en `start.mjs`) solo si se ejecutan.
