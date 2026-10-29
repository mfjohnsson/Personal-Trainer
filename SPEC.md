# SPEC – Personlig tränings- och kostapp

## Mål
En mobilapp (Android, installerbar PWA) som varje vecka genererar ett träningsschema och ett kostschema som tar Mart från 82,5 kg till ca 74 kg genom att minska fett och bygga/behålla muskler.

Appen är klar när:
- Varje söndag finns en ny vecka med träningspass och måltider, uträknade från aktuell vikt och målvikt.
- Set och pass kan bockas av i mobilen och styr nästa veckas progression.
- En måltid kan bytas eller ersättas, och dagens återstående måltider justeras så att dagen hamnar nära kalori- och proteinmålet.
- Veckans vikt och midja justerar kalorierna automatiskt.

## Utanför scope
- Konto, inloggning, backend och synk mellan enheter
- Streckkodsskanning och koppling till andra appar/hälsodata
- Loggning av lyftvikter per set
- Avbockning av måltider (de visas bara)
- AI-anrop (all logik är regelbaserad)
- Datorversion (enbart mobil)

## Utgångsdata
- Längd 170 cm, vikt 82,5 kg, midja 97 cm, målvikt 74 kg. Ålder matas in i startprofilen.
- Aktivitetsnivå utanför träning: måttligt aktiv
- Protein: ca 170 g/dag
- Hemmagym (skivstång, hantlar)
- Träning: Push mån, distans tis, Pull ons, intervaller tor, Legs fre. Dagligen minst 5 pull-ups och 50 armhävningar. Incline hantelpress i stället för armhävningar på måndagar.
- Kost (låst struktur):
  - Frukost: 2 skivor proteinbröd/Fröbröd + ägg + tomat
  - Lunch: 200 g protein + 150 g långsamma kolhydrater (fullkorn/quinoa/matvete) + en näve grönsaker
  - Mellanmål (roteras): proteinshake ELLER turkisk yoghurt + jordnötssmör + bär ELLER keso + frukt + nötter
  - Middag: familjens middag med mindre kolhydrater
- Budgetmedveten, känslig mage (inga påtvingade baljväxter)

## Specs i ordning (en session vardera)

### 1. Grund och design
PWA-skal (manifest, service worker, installerbar på Android), lokal lagring (IndexedDB eller localStorage med versionerat schema). Design och komponenter efter Viktkollen. Navigering: Idag / Vecka / Kost / Profil.

### 2. Startprofil
Formulär: ålder, längd, vikt, midja, målvikt. Beräkna BMR (Mifflin-St Jeor), TDEE (måttligt aktiv) och dagligt kaloriunderskott för 0,5 % kroppsvikt/vecka. Proteinmål 170 g (eller ca 2 g/kg målvikt). Visa beräknad måldatum.

### 3. Veckans träningsschema
Generera veckan enligt splitten ovan med övningar, set och reps. Dagliga minimum visas varje dag. Avbockning per set och per pass. Ett missat pass flyttas till nästa lediga dag samma vecka.

### 4. Progression
Regel per övning: alla set avbockade två veckor i rad → höj reps (inom intervall) eller vikt nästa vecka. Något set missat → samma nivå. Konditionspassen ökar tid/intervaller enligt samma princip.

### 5. Veckans kostschema
Fördela de låsta måltiderna över veckan, rotera mellanmål och lunchprotein. Måltidsdatabas med kalorier och protein per portion. Portionerna skalas så att dagen träffar kalori- och proteinmålet.

### 6. Byta eller lägga till måltid
- Byt: välj bland rätter med liknande kalorier/protein (±10 %).
- Ät något annat: ange ungefärliga kalorier och protein. Dagens återstående måltider skalas om så att dagen hamnar nära målet. Gäller bara samma dag.

### 7. Veckoavstämning (söndag)
Logga vikt och midja. Jämför med målkurvan: viktminskning under 0,25 %/vecka → −150 kcal; över 1 %/vecka → +150 kcal. Generera nästa veckas tränings- och kostschema. Visa en enkel viktkurva.

### 8. Inköpslista
Summera veckans ingredienser per kategori. Avbockningsbar lista.

## Bekräftade beslut
1. PWA, installerbar webbapp utan konto, backend eller synk — JA
2. Ny app med Viktkollens design — JA
3. Takt 0,5 %/vecka (ca 0,4 kg, runt 21 veckor till 74 kg) — JA
4. Progression via avbockade set, ingen viktloggning — JA
5. Måltider visas bara; byte/tillägg justerar endast samma dag — JA
6. Veckoavstämning och ny vecka på söndagar — JA
7. Inköpslista ingår — JA
