#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
	return fs.readFileSync(path, "utf8");
}

const cosmetics = read("src/renderer/cosmetics.ts");
const avatar = read("src/renderer/Avatar.tsx");

let failures = 0;
function check(name, ok, detail = "") {
	if (ok) {
		console.log(`COSMETIC_PASS ${name}`);
	} else {
		failures += 1;
		console.log(`COSMETIC_FAIL ${name}${detail ? ` ${detail}` : ""}`);
	}
}

check(
	"source_cosmetic_types_include_skin_and_visor",
	/export enum cosmeticType[\s\S]*?skin[\s\S]*?visor/.test(cosmetics),
);
check(
	"source_avatar_uses_specific_skin_and_visor_types",
	/getCosmetic\(color, isAlive, cosmeticType\.skin, skin, mod\)/.test(avatar) &&
		/getCosmetic\(color, isAlive, cosmeticType\.visor, visor, mod\)/.test(
			avatar,
		) &&
		/getHatDementions\(skin, mod, cosmeticType\.skin\)/.test(avatar) &&
		/getHatDementions\(visor, mod, cosmeticType\.visor\)/.test(avatar),
);
check(
	"source_cosmetics_resolves_alias_ids",
	/function getCosmeticAliasKeys/.test(cosmetics) &&
		/function normalizeCosmeticId/.test(cosmetics) &&
		/asset_name/.test(cosmetics) &&
		/image/.test(cosmetics),
);
check(
	"source_cosmetics_filters_by_cosmetic_kind",
	/function isHatDataForCosmeticType/.test(cosmetics) &&
		/hat_type/.test(cosmetics) &&
		/cosmeticType\.skin/.test(cosmetics) &&
		/cosmeticType\.visor/.test(cosmetics),
);
check(
	"source_cosmetics_prefers_active_mod_before_vanilla_fallback",
	/function getCosmeticModSearchOrder/.test(cosmetics) &&
		/\[modType, 'NONE'\]/.test(cosmetics),
);
check(
	"source_cosmetics_handles_tou_mira_skin_suffix_aliases",
	/replace\(\/skin\$\//.test(cosmetics) ||
		/replace\(\/skins\?\$\//.test(cosmetics),
);

console.log(`METRIC cosmetic_failures=${failures}`);
