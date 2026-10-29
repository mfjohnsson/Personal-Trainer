# KRITERIER – Personlig tränings- och kostapp

Varje kriterium bedöms ja/nej. Testmetod inom parentes.

## 1. Grund och design
- [ ] Appen kan installeras på Android-hemskärmen och öppnas i helskärm utan webbläsarens adressfält. (Chrome på mobilen → "Lägg till på startskärmen")
- [ ] Appen startar och visar senast sparad data i flygplansläge. (Installera, slå på flygplansläge, öppna)
- [ ] Data finns kvar efter att appen stängts och mobilen startats om. (Mata in profil, starta om, öppna)
- [ ] Alla fyra vyer (Idag/Vecka/Kost/Profil) går att nå med högst ett tryck från vilken vy som helst. (Klicka igenom)
- [ ] Ingen horisontell scroll på en skärm 360 px bred. (DevTools mobilvy 360 px)

## 2. Startprofil
- [ ] Med ålder 35, 170 cm, 82,5 kg ger appen samma BMR som Mifflin-St Jeor räknat för hand (±5 kcal). (Jämför med handräkning)
- [ ] Dagligt kalorimål motsvarar ett underskott för ca 0,41 kg/vecka (±10 %). (Kontrollräkna: 0,41 × 7700 / 7)
- [ ] Proteinmålet visas som 170 g. (Titta i profilvyn)
- [ ] Beräknat måldatum för 74 kg visas och ligger 19–23 veckor fram. (Titta i profilvyn)
- [ ] Ogiltiga värden (t.ex. vikt 0 eller tomt fält) kan inte sparas. (Försök spara)

## 3. Veckans träningsschema
- [ ] Veckan visar Push mån, distans tis, Pull ons, intervaller tor, Legs fre. (Vecka-vyn)
- [ ] Måndagens pass innehåller incline hantelpress och inte armhävningar. (Öppna måndag)
- [ ] Varje dag visar dagliga minimum: 5 pull-ups och 50 armhävningar. (Klicka igenom dagarna)
- [ ] Ett set kan bockas av och av-bockas, och passet markeras klart när alla set är avbockade. (Bocka i mobilen)
- [ ] Ett omarkerat pass från en tidigare dag flyttas till nästa lediga dag samma vecka. (Sätt telefonens datum en dag fram eller använd testdatum)

## 4. Progression
- [ ] En övning med alla set klara två veckor i rad får högre reps eller vikt veckan därpå. (Simulera två veckor med testdata)
- [ ] En övning där minst ett set missats behåller samma nivå. (Simulera med testdata)
- [ ] Reps höjs inom intervallet innan vikten höjs. (Kontrollera tre veckors simulering)
- [ ] Konditionspass ökar tid eller antal intervaller efter två fullständiga veckor. (Simulera med testdata)

## 5. Veckans kostschema
- [ ] Varje dag har frukost, lunch, mellanmål och middag enligt den låsta strukturen. (Kost-vyn)
- [ ] Varje dags summa ligger inom ±5 % av kalorimålet och ±10 g av proteinmålet. (Summorna som visas i appen jämfört med målen)
- [ ] Inget mellanmål upprepas två dagar i rad. (Kolla veckan)
- [ ] Inga baljväxter förekommer om de inte lagts till manuellt. (Kolla veckan)

## 6. Byta eller lägga till måltid
- [ ] Vid byte visas bara rätter inom ±10 % av originalets kalorier och protein. (Byt en lunch, kontrollera värdena)
- [ ] Efter att en egen måltid lagts in skalas dagens återstående måltider så att dagen hamnar inom ±10 % av kalorimålet. (Lägg in 800 kcal vid lunch)
- [ ] En justering påverkar bara den dagen; övriga dagar är oförändrade. (Jämför veckan före och efter)
- [ ] Om dagens återstående måltider inte räcker för att hålla målet visas ett tydligt meddelande i stället för negativa portioner. (Lägg in 3000 kcal)

## 7. Veckoavstämning
- [ ] På söndagar uppmanas man att logga vikt och midja. (Sätt datum till söndag)
- [ ] Viktminskning under 0,25 %/vecka sänker kalorimålet med 150 kcal. (Testdata)
- [ ] Viktminskning över 1 %/vecka höjer kalorimålet med 150 kcal. (Testdata)
- [ ] Efter avstämningen finns nästa veckas tränings- och kostschema. (Kontrollera Vecka- och Kost-vyn)
- [ ] Viktkurvan visar alla loggade veckor. (Logga tre veckor testdata)

## 8. Inköpslista
- [ ] Listan innehåller alla ingredienser från veckans kostschema, sammanslagna per vara. (Jämför med kostschemat)
- [ ] Varorna är grupperade per kategori. (Titta på listan)
- [ ] Varor kan bockas av och avbockningen finns kvar efter omstart. (Bocka, stäng, öppna)
- [ ] Ett måltidsbyte uppdaterar inköpslistan. (Byt en rätt, kolla listan)
