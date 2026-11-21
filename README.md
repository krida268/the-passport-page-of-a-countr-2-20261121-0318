[![make.fun · the-passport-page-of-a-countr-2-20261121-0318](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![rank](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/krida268/the-passport-page-of-a-countr-2-20261121-0318/rank.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![reward](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/krida268/the-passport-page-of-a-countr-2-20261121-0318/reward.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)

# The Passport Page of a Country That Isn't There

A single procedurally drawn image: an open passport spread from the
**Republic of Auralia**, an invented island republic in the southern
Meridian Sea. Capital: **Port Venn**. Languages: Auralian / English.
Motto: *"By Sea and Star"*. Emblem: a white gull over a five-pointed star
on deep blue. Currency: the aural (AUR). No real country's logo, seal, or
document is used anywhere — every mark on the page is invented.

## The holder

**Mara Venn**, born 02 Jun 1991 in Port Venn, Auralian citizen.
Passport **AU-0048217**, issued 14 Mar 2024 in Port Venn, valid until
13 Mar 2034.

## The story on the pages

The left page is the data page: a procedural portrait, bilingual
(Auralian / English) personal data, signature, and a two-line ICAO MRZ
(44 characters per line, check digits computed, not typed).

The right page is the visa and stamps page:

- **Telmara tourist visa**, 30 days, issued 28 Aug 2025 in Sorrel Bay —
  *"EMPLOYMENT PROHIBITED — TOURIST ONLY"* — with a fee stamp:
  *"VISA FEE 40 AUR PAID"*.
- **Norvask** (north, across the strait; capital Kaldvik): arrival
  03 May 2024, departure 18 May 2024, then arrival back in Port Venn
  18 May 2024.
- **Telmara** (east; Sorrel Bay): arrival 09 Sep 2025, departure
  22 Sep 2025, then arrival back in Port Venn 22 Sep 2025.

Every stamp falls after the passport's issue date (14 Mar 2024), and
the lower half of the data page carries a schematic map of the Meridian
Sea showing Auralia between Norvask and Telmara, with Mara Venn's two
voyages drawn as dashed routes.

## How it is made

`main.ts` (Node 22, standard library only) draws everything from
scratch: a pure PNG encoder, a hand-built 5×7 bitmap font, vector
emblem, portrait, stamps, and map. No network, no clock, no unseeded
randomness — the same run always produces the same bytes.

## Run

```sh
mkdir -p out
MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png — 1024×1024, under 1 MiB, byte-identical every run
```

Referral code: `enzt809f`

## License

MIT — see [LICENSE](LICENSE).
