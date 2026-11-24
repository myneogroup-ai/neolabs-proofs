# NEOLABS Official Test No. 4 - public sample

The ten tasks below were drawn by round 34217812 of the drand quicknet beacon (League of Entropy), the round the protocol fixed before the run.
The evidence pack was sealed before that round existed: NEO AI did not choose these tasks. They are published in full, as the protocol promised:
the text each system received, the expected answer, and for each system whether its final answer was exact. The other 89 tasks stay private so the set remains usable.

Drawn task ids, in the order of the draw: r134-fr, d110-fr, c83-en, c77-en, c68-fr, d77-en, d106-fr, r114-fr, d105-en, d109-en.

## r134-fr - reasoning, French

Task, as sent:

```
Voici 15 entiers différents : 3, 6, 14, 19, 22, 27, 28, 30, 42, 43, 44, 46, 50, 56, 58. Combien d'ensembles différents de ces entiers (chaque entier utilisé au plus une fois, l'ordre ne compte pas) ont une somme exactement égale à 161 ?
```

Expected answer: `88`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 4.9 s | 0.0262 USD |
| GPT-5.5 | completed | yes | 7.1 s | 0.0520 USD |
| NEO AUTO | completed | yes | 4.8 s | 0.0015 USD |
| NEO PRIME | completed | no | 66.1 s | 0.0126 USD |
| NEO PULSE | completed | no | 7.3 s | 0.0377 USD |

## d110-fr - data, French

Task, as sent:

```
Voici 34 factures, triées par date.

facture | date | client | montant
F01 | 2026-04-02 | Corvus | 200
F02 | 2026-04-04 | Dune | 810
F03 | 2026-04-06 | Corvus | 910
F04 | 2026-04-06 | Corvus | 670
F05 | 2026-04-07 | Corvus | 880
F06 | 2026-04-07 | Bouleau | 260
F07 | 2026-04-07 | Braise | 500
F08 | 2026-04-08 | Braise | 480
F09 | 2026-04-08 | Corvus | 880
F10 | 2026-04-09 | Corvus | 880
F11 | 2026-04-11 | Braise | 500
F12 | 2026-04-11 | Corvus | 910
F13 | 2026-04-11 | Corvus | 880
F14 | 2026-04-11 | Corvus | 880
F15 | 2026-04-12 | Braise | 360
F16 | 2026-04-14 | Braise | 660
F17 | 2026-04-15 | Bouleau | 190
F18 | 2026-04-16 | Dune | 380
F19 | 2026-04-17 | Dune | 380
F20 | 2026-04-18 | Dune | 260
F21 | 2026-04-18 | Bouleau | 520
F22 | 2026-04-18 | Bouleau | 520
F23 | 2026-04-20 | Braise | 430
F24 | 2026-04-20 | Ardoise | 220
F25 | 2026-04-21 | Bouleau | 570
F26 | 2026-04-22 | Ardoise | 190
F27 | 2026-04-24 | Corvus | 310
F28 | 2026-04-26 | Dune | 210
F29 | 2026-04-26 | Dune | 450
F30 | 2026-04-26 | Corvus | 750
F31 | 2026-04-26 | Ardoise | 190
F32 | 2026-04-28 | Corvus | 750
F33 | 2026-04-29 | Corvus | 750
F34 | 2026-04-30 | Ardoise | 190

Parcours les lignes de haut en bas. Une facture est un doublon, et elle est écartée, lorsqu'une facture antérieure qui a été CONSERVÉE a le même client et le même montant et une date antérieure d'au plus 3 jours (le même jour compte). Une facture qui n'est pas un doublon est conservée. Quel est le montant total des factures conservées ?
```

Expected answer: `12880`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 14.8 s | 0.0573 USD |
| GPT-5.5 | completed | yes | 19.1 s | 0.0880 USD |
| NEO AUTO | completed | yes | 11.4 s | 0.0486 USD |
| NEO PRIME | completed | yes | 9.8 s | 0.0047 USD |
| NEO PULSE | completed | yes | 9.3 s | 0.0022 USD |

## c83-en - code, English

Task, as sent:

```
What does this Python 3 program print? Work it out without running it.

class Tag:
    seen = []

    def __init__(self, name, weight):
        self.name = name
        self.weight = weight
        self.seen.append(name)

    def __eq__(self, other):
        return self.name.lower() == other.name.lower()

    def __hash__(self):
        return hash(self.name.lower())

tags = [Tag(n, w) for n, w in [('Sol', 6), ('sol', 1), ('Mar', 4), ('MAR', 2), ('Luz', 8)]]
unique = set(tags)
x = Tag('mar', 5)
x.seen = x.seen + ["extra"]
y = Tag('mar'.upper(), 1)
print(len(unique) * 100 + sum(t.weight for t in unique) + len(Tag.seen) * 10 + len(x.seen) + (x in unique) + (y == x))
```

Expected answer: `397`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 10.8 s | 0.0370 USD |
| GPT-5.5 | completed | yes | 12.3 s | 0.0336 USD |
| NEO AUTO | completed | yes | 9.7 s | 0.0020 USD |
| NEO PRIME | completed | yes | 8.2 s | 0.0012 USD |
| NEO PULSE | completed | yes | 7.7 s | 0.0014 USD |

## c77-en - code, English

Task, as sent:

```
What does this Python 3 program print? Work it out without running it.

text = "  la salade de bananes  et d'avocats "
a = text.title()
b = text.split(" ")
c = text.split()
d = text.strip(' las')
e = text.replace("a", "", 2)
print(sum(1 for x, y in zip(text, a) if x != y) * 1000 + len(b) * 100 + len(c) * 10 + len(d) + text.rfind("a") - text.find("a") + len(e))
```

Expected answer: `8151`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 10.1 s | 0.0366 USD |
| GPT-5.5 | completed | yes | 18.3 s | 0.0500 USD |
| NEO AUTO | completed | yes | 11.1 s | 0.0022 USD |
| NEO PRIME | completed | yes | 11.5 s | 0.0015 USD |
| NEO PULSE | completed | yes | 13.3 s | 0.0021 USD |

## c68-fr - code, French

Task, as sent:

```
Qu'affiche ce programme Python 3 ? Trouve le résultat sans l'exécuter.

evens = (x for x in range(14) if x % 2 == 0)
squares = (x * x for x in range(1, 14))
first = sum(a + b for a, b in zip(evens, squares))
left = list(squares)
pairs = list(zip(range(9), "abcdefgh", evens))
gen = (i * 4 for i in range(5))
total = sum(gen) + sum(gen)
print(first + len(left) * 100 + len(pairs) + total + (left[0] if left else 7))
```

Expected answer: `886`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 8.7 s | 0.0323 USD |
| GPT-5.5 | completed | yes | 8.9 s | 0.0317 USD |
| NEO AUTO | completed | yes | 7.5 s | 0.0016 USD |
| NEO PRIME | completed | yes | 6.6 s | 0.0041 USD |
| NEO PULSE | completed | yes | 6.2 s | 0.0012 USD |

## d77-en - data, English

Task, as sent:

```
Here are 30 room bookings of one day. Bookings of the same room may overlap.

booking | room | start | end
B01 | Cedar | 08:38 | 10:02
B02 | Baltic | 11:22 | 13:18
B03 | Baltic | 09:41 | 10:45
B04 | Atlas | 14:26 | 14:55
B05 | Baltic | 13:30 | 15:24
B06 | Atlas | 09:23 | 11:33
B07 | Baltic | 13:26 | 15:48
B08 | Cedar | 10:39 | 11:07
B09 | Cedar | 16:22 | 18:40
B10 | Cedar | 13:26 | 14:12
B11 | Cedar | 09:51 | 11:41
B12 | Cedar | 15:45 | 17:57
B13 | Atlas | 12:34 | 14:47
B14 | Cedar | 16:45 | 17:09
B15 | Cedar | 12:51 | 14:23
B16 | Cedar | 11:29 | 12:12
B17 | Cedar | 12:00 | 13:13
B18 | Atlas | 17:17 | 17:51
B19 | Cedar | 08:07 | 09:19
B20 | Baltic | 15:38 | 16:39
B21 | Cedar | 11:35 | 13:54
B22 | Cedar | 15:59 | 17:05
B23 | Baltic | 11:50 | 13:59
B24 | Cedar | 13:24 | 15:32
B25 | Cedar | 14:45 | 16:11
B26 | Cedar | 13:44 | 14:13
B27 | Atlas | 13:40 | 14:28
B28 | Baltic | 13:17 | 14:03
B29 | Cedar | 17:22 | 18:54
B30 | Cedar | 14:45 | 15:55

During how many minutes of the day is the room Cedar booked at least once? A minute covered by several bookings counts once.
```

Expected answer: `647`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 7.8 s | 0.0375 USD |
| GPT-5.5 | completed | yes | 14.1 s | 0.0719 USD |
| NEO AUTO | completed | yes | 17.4 s | 0.0422 USD |
| NEO PRIME | completed | yes | 2.6 s | 0.0008 USD |
| NEO PULSE | completed | no | 1.7 s | 0.0076 USD |

## d106-fr - data, French

Task, as sent:

```
Voici 34 factures, triées par date.

facture | date | client | montant
F01 | 2026-04-01 | Bouleau | 920
F02 | 2026-04-01 | Corvus | 710
F03 | 2026-04-01 | Bouleau | 920
F04 | 2026-04-02 | Dune | 300
F05 | 2026-04-02 | Bouleau | 390
F06 | 2026-04-02 | Bouleau | 920
F07 | 2026-04-03 | Corvus | 730
F08 | 2026-04-03 | Corvus | 840
F09 | 2026-04-05 | Bouleau | 920
F10 | 2026-04-06 | Dune | 260
F11 | 2026-04-06 | Bouleau | 820
F12 | 2026-04-06 | Corvus | 840
F13 | 2026-04-07 | Corvus | 730
F14 | 2026-04-08 | Corvus | 730
F15 | 2026-04-10 | Dune | 420
F16 | 2026-04-10 | Bouleau | 820
F17 | 2026-04-10 | Dune | 260
F18 | 2026-04-11 | Ardoise | 820
F19 | 2026-04-11 | Dune | 260
F20 | 2026-04-13 | Dune | 280
F21 | 2026-04-15 | Corvus | 690
F22 | 2026-04-15 | Corvus | 730
F23 | 2026-04-19 | Dune | 680
F24 | 2026-04-19 | Dune | 280
F25 | 2026-04-20 | Ardoise | 830
F26 | 2026-04-21 | Ardoise | 650
F27 | 2026-04-22 | Braise | 340
F28 | 2026-04-24 | Braise | 500
F29 | 2026-04-24 | Braise | 850
F30 | 2026-04-25 | Braise | 500
F31 | 2026-04-26 | Ardoise | 280
F32 | 2026-04-26 | Braise | 500
F33 | 2026-04-28 | Braise | 850
F34 | 2026-04-30 | Braise | 850

Parcours les lignes de haut en bas. Une facture est un doublon, et elle est écartée, lorsqu'une facture antérieure qui a été CONSERVÉE a le même client et le même montant et une date antérieure d'au plus 3 jours (le même jour compte). Une facture qui n'est pas un doublon est conservée. Quel est le montant total des factures conservées ?
```

Expected answer: `15900`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 15.2 s | 0.0568 USD |
| GPT-5.5 | completed | yes | 18.3 s | 0.0900 USD |
| NEO AUTO | completed | yes | 15.4 s | 0.0601 USD |
| NEO PRIME | completed | yes | 10.1 s | 0.0020 USD |
| NEO PULSE | completed | yes | 9.9 s | 0.0023 USD |

## r114-fr - reasoning, French

Task, as sent:

```
Le jeu de la vie de Conway se joue sur un plateau de 7 lignes et 7 colonnes ; toute cellule hors du plateau est morte et le reste. À chaque génération, simultanément : une cellule vivante ayant 2 ou 3 voisines vivantes reste vivante, une cellule morte ayant exactement 3 voisines vivantes devient vivante, toute autre cellule est morte. Une cellule a jusqu'à 8 voisines (les cellules qui la touchent, diagonales comprises). Génération 0, où # est vivante et . est morte :

.####..
#..#.#.
...#...
###.##.
#.#..##
#..##.#
#....#.

Combien de cellules sont vivantes à la génération 5 ?
```

Expected answer: `19`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 6.4 s | 0.0328 USD |
| GPT-5.5 | completed | yes | 16.8 s | 0.0747 USD |
| NEO AUTO | completed | yes | 6.4 s | 0.0018 USD |
| NEO PRIME | failed | no | 125.3 s | 0.0254 USD |
| NEO PULSE | completed | no | 46.1 s | 0.1599 USD |

## d105-en - data, English

Task, as sent:

```
Here are 34 invoices, sorted by date.

invoice | date | customer | amount
F01 | 2026-04-01 | Birch | 480
F02 | 2026-04-02 | Ember | 530
F03 | 2026-04-03 | Dune | 950
F04 | 2026-04-04 | Dune | 350
F05 | 2026-04-05 | Birch | 480
F06 | 2026-04-06 | Arden | 610
F07 | 2026-04-06 | Arden | 610
F08 | 2026-04-07 | Birch | 190
F09 | 2026-04-07 | Birch | 190
F10 | 2026-04-08 | Ember | 800
F11 | 2026-04-08 | Arden | 540
F12 | 2026-04-08 | Dune | 350
F13 | 2026-04-09 | Birch | 480
F14 | 2026-04-13 | Dune | 630
F15 | 2026-04-14 | Dune | 660
F16 | 2026-04-14 | Dune | 660
F17 | 2026-04-15 | Arden | 830
F18 | 2026-04-16 | Arden | 310
F19 | 2026-04-17 | Ember | 370
F20 | 2026-04-17 | Dune | 660
F21 | 2026-04-19 | Birch | 750
F22 | 2026-04-19 | Dune | 660
F23 | 2026-04-19 | Dune | 660
F24 | 2026-04-20 | Corvus | 620
F25 | 2026-04-20 | Dune | 460
F26 | 2026-04-22 | Corvus | 650
F27 | 2026-04-22 | Birch | 750
F28 | 2026-04-23 | Arden | 830
F29 | 2026-04-23 | Dune | 540
F30 | 2026-04-23 | Dune | 460
F31 | 2026-04-24 | Corvus | 620
F32 | 2026-04-25 | Birch | 870
F33 | 2026-04-25 | Corvus | 620
F34 | 2026-04-26 | Dune | 350

Go through the rows from top to bottom. An invoice is a duplicate, and is discarded, when an earlier invoice that was KEPT has the same customer and the same amount and a date at most 3 days before it (the same day counts). An invoice that is not a duplicate is kept. What is the total amount of the invoices kept?
```

Expected answer: `14910`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 13.0 s | 0.0519 USD |
| GPT-5.5 | completed | yes | 13.3 s | 0.0775 USD |
| NEO AUTO | completed | yes | 14.8 s | 0.0554 USD |
| NEO PRIME | completed | yes | 10.0 s | 0.0019 USD |
| NEO PULSE | completed | yes | 9.7 s | 0.0024 USD |

## d109-en - data, English

Task, as sent:

```
Here are 34 invoices, sorted by date.

invoice | date | customer | amount
F01 | 2026-04-01 | Ember | 330
F02 | 2026-04-02 | Arden | 450
F03 | 2026-04-02 | Ember | 340
F04 | 2026-04-02 | Ember | 610
F05 | 2026-04-03 | Birch | 840
F06 | 2026-04-03 | Ember | 800
F07 | 2026-04-04 | Dune | 510
F08 | 2026-04-05 | Birch | 470
F09 | 2026-04-05 | Birch | 650
F10 | 2026-04-05 | Birch | 470
F11 | 2026-04-05 | Arden | 450
F12 | 2026-04-06 | Ember | 800
F13 | 2026-04-07 | Corvus | 790
F14 | 2026-04-07 | Arden | 910
F15 | 2026-04-07 | Corvus | 790
F16 | 2026-04-07 | Ember | 800
F17 | 2026-04-08 | Birch | 650
F18 | 2026-04-10 | Dune | 730
F19 | 2026-04-11 | Arden | 880
F20 | 2026-04-11 | Arden | 630
F21 | 2026-04-11 | Arden | 800
F22 | 2026-04-11 | Dune | 730
F23 | 2026-04-14 | Arden | 800
F24 | 2026-04-15 | Arden | 800
F25 | 2026-04-16 | Arden | 800
F26 | 2026-04-17 | Birch | 670
F27 | 2026-04-18 | Birch | 470
F28 | 2026-04-20 | Corvus | 570
F29 | 2026-04-22 | Dune | 510
F30 | 2026-04-23 | Arden | 230
F31 | 2026-04-24 | Birch | 300
F32 | 2026-04-25 | Arden | 820
F33 | 2026-04-29 | Arden | 820
F34 | 2026-04-29 | Birch | 300

Go through the rows from top to bottom. An invoice is a duplicate, and is discarded, when an earlier invoice that was KEPT has the same customer and the same amount and a date at most 3 days before it (the same day counts). An invoice that is not a duplicate is kept. What is the total amount of the invoices kept?
```

Expected answer: `16030`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 15.2 s | 0.0549 USD |
| GPT-5.5 | completed | yes | 12.8 s | 0.0778 USD |
| NEO AUTO | completed | yes | 15.0 s | 0.0582 USD |
| NEO PRIME | completed | yes | 10.1 s | 0.0018 USD |
| NEO PULSE | completed | yes | 10.9 s | 0.0022 USD |

