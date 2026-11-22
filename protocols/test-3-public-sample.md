# NEOLABS Official Test No. 3 - public sample

The ten tasks below were drawn by round 34185412 of the drand quicknet beacon (League of Entropy), the round the protocol fixed before the run.
The evidence pack was sealed before that round existed: NEO AI did not choose these tasks. They are published in full, as the protocol promised:
the text each system received, the expected answer, and for each system whether its final answer was exact. The other 89 tasks stay private so the set remains usable.

Drawn task ids, in the order of the draw: d89-en, r131-en, d80-fr, r121-en, d109-en, r142-fr, c59-en, d95-en, r139-en, d104-fr.

## d89-en - data, English

Task, as sent:

```
Table 1, 26 payments:

payment | date | currency | amount
T01 | 2026-03-05 | EUR | 19.50
T02 | 2026-03-06 | CHF | 903.59
T03 | 2026-03-03 | CHF | 115.72
T04 | 2026-03-05 | GBP | 807.85
T05 | 2026-03-05 | CHF | 527.24
T06 | 2026-03-06 | CHF | 865.51
T07 | 2026-03-05 | GBP | 920.12
T08 | 2026-03-04 | CHF | 62.03
T09 | 2026-03-05 | CHF | 541.23
T10 | 2026-03-04 | GBP | 883.08
T11 | 2026-03-06 | EUR | 892.00
T12 | 2026-03-03 | GBP | 305.74
T13 | 2026-03-05 | GBP | 456.53
T14 | 2026-03-03 | EUR | 644.00
T15 | 2026-03-06 | CHF | 767.44
T16 | 2026-03-05 | GBP | 411.50
T17 | 2026-03-03 | CHF | 732.28
T18 | 2026-03-05 | EUR | 842.64
T19 | 2026-03-06 | GBP | 315.98
T20 | 2026-03-03 | CHF | 18.11
T21 | 2026-03-05 | EUR | 742.24
T22 | 2026-03-04 | EUR | 256.72
T23 | 2026-03-05 | CHF | 976.35
T24 | 2026-03-03 | EUR | 145.82
T25 | 2026-03-03 | CHF | 908.04
T26 | 2026-03-05 | CHF | 350.62

Table 2, the exchange rate of each currency on each day:

date | currency | US dollars for 1 unit
2026-03-03 | EUR | 1.0406
2026-03-03 | GBP | 1.3048
2026-03-03 | CHF | 1.1664
2026-03-04 | EUR | 1.0739
2026-03-04 | GBP | 1.2516
2026-03-04 | CHF | 1.1873
2026-03-05 | EUR | 1.0602
2026-03-05 | GBP | 1.2497
2026-03-05 | CHF | 1.1532
2026-03-06 | EUR | 1.0834
2026-03-06 | GBP | 1.2820
2026-03-06 | CHF | 1.1328

Each payment is converted to US dollars at the rate of its own currency on its own date. What is the total in US dollars of all 26 payments, rounded to 2 decimals?
```

Expected answer: `16697.27`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 12.0 s | 0.0560 USD |
| GPT-5.5 | completed | yes | 12.0 s | 0.0730 USD |
| NEO AUTO | completed | yes | 11.6 s | 0.0568 USD |
| NEO PRIME | completed | yes | 7.0 s | 0.0015 USD |
| NEO PULSE | completed | yes | 6.4 s | 0.0018 USD |

## r131-en - reasoning, English

Task, as sent:

```
Here are 15 different integers: 8, 9, 14, 19, 20, 23, 24, 30, 34, 36, 40, 41, 51, 55, 57. How many different sets of these integers (each integer used at most once, the order does not matter) have a sum of exactly 150?
```

Expected answer: `98`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 6.6 s | 0.0264 USD |
| GPT-5.5 | completed | yes | 11.6 s | 0.0555 USD |
| NEO AUTO | completed | yes | 15.1 s | 0.0317 USD |
| NEO PRIME | failed | no | 144.3 s | 0.0245 USD |
| NEO PULSE | completed | yes | 11.8 s | 0.0685 USD |

## d80-fr - data, French

Task, as sent:

```
Voici 30 réservations de salles sur une journée. Les réservations d'une même salle peuvent se chevaucher.

réservation | salle | début | fin
B01 | Cèdre | 17:28 | 17:50
B02 | Atlas | 09:09 | 11:01
B03 | Atlas | 16:09 | 18:36
B04 | Cèdre | 11:11 | 12:06
B05 | Cèdre | 09:44 | 10:29
B06 | Baltique | 10:29 | 11:47
B07 | Baltique | 12:19 | 14:20
B08 | Cèdre | 10:35 | 12:48
B09 | Atlas | 08:40 | 09:59
B10 | Atlas | 09:57 | 10:42
B11 | Cèdre | 13:22 | 14:35
B12 | Cèdre | 11:18 | 13:38
B13 | Cèdre | 15:45 | 17:36
B14 | Cèdre | 09:48 | 11:51
B15 | Atlas | 14:36 | 16:07
B16 | Atlas | 10:18 | 11:59
B17 | Baltique | 14:03 | 15:03
B18 | Atlas | 11:04 | 11:27
B19 | Cèdre | 11:32 | 13:30
B20 | Baltique | 09:42 | 11:47
B21 | Baltique | 16:43 | 18:54
B22 | Baltique | 11:03 | 12:47
B23 | Cèdre | 08:06 | 08:29
B24 | Atlas | 17:21 | 18:00
B25 | Baltique | 17:23 | 18:20
B26 | Cèdre | 09:52 | 11:32
B27 | Cèdre | 11:33 | 13:26
B28 | Atlas | 17:06 | 18:04
B29 | Cèdre | 14:26 | 16:30
B30 | Atlas | 17:45 | 19:14

Pendant combien de minutes de la journée la salle Cèdre est-elle réservée au moins une fois ? Une minute couverte par plusieurs réservations compte une seule fois.
```

Expected answer: `509`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 8.8 s | 0.0368 USD |
| GPT-5.5 | completed | yes | 17.4 s | 0.1553 USD |
| NEO AUTO | completed | yes | 6.4 s | 0.0018 USD |
| NEO PRIME | completed | yes | 2.9 s | 0.0010 USD |
| NEO PULSE | completed | yes | 1.4 s | 0.0077 USD |

## r121-en - reasoning, English

Task, as sent:

```
The integers 1 to 11 are written in a row, each exactly once, so that the row starts with 3 and every two numbers that are next to each other have a sum that is a prime number. How many such rows are there?
```

Expected answer: `304`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 8.9 s | 0.0346 USD |
| GPT-5.5 | completed | yes | 22.6 s | 0.0751 USD |
| NEO AUTO | completed | yes | 5.4 s | 0.0016 USD |
| NEO PRIME | failed | no | 162.4 s | 0.0262 USD |
| NEO PULSE | completed | no | 15.8 s | 0.1030 USD |

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
| Claude Opus 5.5 | completed | yes | 15.3 s | 0.0553 USD |
| GPT-5.5 | completed | yes | 18.6 s | 0.0836 USD |
| NEO AUTO | completed | yes | 14.0 s | 0.0513 USD |
| NEO PRIME | completed | yes | 10.1 s | 0.0021 USD |
| NEO PULSE | completed | yes | 10.7 s | 0.0022 USD |

## r142-fr - reasoning, French

Task, as sent:

```
Sur un échiquier standard 8x8 (colonnes a à h, rangées 1 à 8), on doit placer huit dames de sorte qu'aucune n'en attaque une autre (jamais deux sur la même colonne, la même rangée ou la même diagonale). Aucune dame ne peut occuper ces cases : b1, c1, e1, f1, c2, c3, g3, e4, h8. De combien de façons peut-on placer les huit dames ?
```

Expected answer: `20`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 7.7 s | 0.0314 USD |
| GPT-5.5 | completed | yes | 14.4 s | 0.0622 USD |
| NEO AUTO | completed | yes | 18.2 s | 0.1067 USD |
| NEO PRIME | failed | no | 40.5 s | 0.0080 USD |
| NEO PULSE | completed | no | 11.9 s | 0.0831 USD |

## c59-en - code, English

Task, as sent:

```
What does this Python 3 program print? Work it out without running it.

words = ['zèbre', 'écluse', 'abricot', 'Zagreb', 'maïs', 'noix', 'œuf', 'cote', 'côte']
ranked = sorted(words)
last = max(words, key=lambda w: w[2:])
s = "".join(w[::-1] if i % 2 else w for i, w in enumerate(ranked))
print(sum(1 for a, b in zip(s, s[1:]) if a < b) * 10 + ranked.index(last) + len(last))
```

Expected answer: `228`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 16.2 s | 0.0525 USD |
| GPT-5.5 | completed | yes | 26.6 s | 0.0633 USD |
| NEO AUTO | completed | yes | 14.7 s | 0.0027 USD |
| NEO PRIME | completed | no | 14.2 s | 0.0022 USD |
| NEO PULSE | completed | yes | 13.7 s | 0.0022 USD |

## d95-en - data, English

Task, as sent:

```
A warehouse starts empty and values its stock at the moving weighted average cost: after each purchase, the average cost per unit is the value of the stock divided by the units in stock; each sale takes its units out of the stock at the average cost in force at that moment. Nothing is rounded on the way. Here are the 26 movements, in order.

step | movement | units | unit cost
1 | purchase | 53 | 11.51
2 | purchase | 104 | 10.77
3 | sale | 56 | -
4 | sale | 83 | -
5 | purchase | 82 | 10.26
6 | purchase | 132 | 12.25
7 | sale | 19 | -
8 | purchase | 39 | 5.46
9 | purchase | 95 | 5.70
10 | purchase | 85 | 7.06
11 | sale | 61 | -
12 | purchase | 33 | 4.10
13 | sale | 18 | -
14 | sale | 73 | -
15 | sale | 26 | -
16 | sale | 108 | -
17 | purchase | 46 | 12.86
18 | purchase | 69 | 11.27
19 | purchase | 46 | 7.33
20 | purchase | 121 | 4.27
21 | sale | 16 | -
22 | purchase | 40 | 5.36
23 | sale | 66 | -
24 | purchase | 86 | 4.67
25 | sale | 101 | -
26 | purchase | 106 | 8.68

What is the value of the stock after the last movement, rounded to 2 decimals?
```

Expected answer: `3875.67`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 8.5 s | 0.0396 USD |
| GPT-5.5 | completed | yes | 9.8 s | 0.0620 USD |
| NEO AUTO | completed | yes | 6.6 s | 0.0019 USD |
| NEO PRIME | completed | no | 9.8 s | 0.0030 USD |
| NEO PULSE | completed | yes | 4.9 s | 0.0228 USD |

## r139-en - reasoning, English

Task, as sent:

```
On a standard 8x8 chessboard (files a to h, ranks 1 to 8), eight queens must be placed so that no two attack each other (no two on the same file, rank or diagonal). No queen may stand on these squares: g1, c2, e2, b3, c4, a5, c6, b7, c8. In how many ways can the eight queens be placed?
```

Expected answer: `22`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 7.0 s | 0.0407 USD |
| GPT-5.5 | completed | yes | 14.0 s | 0.0611 USD |
| NEO AUTO | completed | yes | 20.1 s | 0.0508 USD |
| NEO PRIME | completed | no | 111.5 s | 0.0181 USD |
| NEO PULSE | completed | no | 12.0 s | 0.0881 USD |

## d104-fr - data, French

Task, as sent:

```
Voici les 28 matchs joués à ce jour dans un championnat de six équipes.

match | équipe à domicile | buts domicile | buts extérieur | équipe à l'extérieur
1 | Faucons | 1 | 2 | Racing
2 | Racing | 3 | 0 | Olympe
3 | Monarque | 0 | 2 | Faucons
4 | Racing | 0 | 2 | Lumen
5 | Lumen | 2 | 1 | Olympe
6 | Faucons | 2 | 0 | Lumen
7 | Havre | 2 | 1 | Monarque
8 | Havre | 3 | 1 | Faucons
9 | Faucons | 4 | 3 | Monarque
10 | Olympe | 3 | 0 | Racing
11 | Havre | 2 | 1 | Olympe
12 | Racing | 2 | 0 | Havre
13 | Olympe | 1 | 2 | Faucons
14 | Lumen | 0 | 3 | Monarque
15 | Racing | 0 | 3 | Faucons
16 | Olympe | 0 | 1 | Lumen
17 | Monarque | 1 | 3 | Olympe
18 | Monarque | 4 | 2 | Racing
19 | Faucons | 2 | 1 | Havre
20 | Lumen | 1 | 0 | Racing
21 | Lumen | 1 | 2 | Faucons
22 | Monarque | 0 | 1 | Havre
23 | Racing | 2 | 0 | Monarque
24 | Havre | 1 | 2 | Racing
25 | Faucons | 0 | 1 | Olympe
26 | Monarque | 2 | 1 | Lumen
27 | Havre | 2 | 0 | Lumen
28 | Olympe | 4 | 1 | Havre

Une victoire donne 3 points, un nul 1 point à chaque équipe, une défaite 0. Les équipes sont classées aux points, puis à la différence de buts (buts marqués moins buts encaissés), puis aux buts marqués. Quelle équipe est classée quatrième ? Réponds par le nom de l'équipe seul.
```

Expected answer: `undefined`

| System | Status | Exact | Time | Cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | completed | yes | 9.8 s | 0.0509 USD |
| GPT-5.5 | completed | yes | 12.8 s | 0.0714 USD |
| NEO AUTO | completed | yes | 8.3 s | 0.0024 USD |
| NEO PRIME | completed | no | 2.7 s | 0.0009 USD |
| NEO PULSE | completed | yes | 2.1 s | 0.0113 USD |

