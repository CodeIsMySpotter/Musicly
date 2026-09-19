# Musicly — Subnautica DAW: Prompt Rozwojowy v2

## Kontekst
Musicly to przeglądarkowy DAW (React 19 + Vite 5 + Tone.js 15 + Zustand 5 + Zundo 2 + Tailwind CSS 4 + react-rnd + lucide-react). Motyw wizualny: Subnautica (głębia oceanu, bioluminescencja). Projekt przeszedł fazę 1 (bugi + refaktor) i fazę 2 (30 poprawek UX/features). Teraz wymaga **fazy 3: stabilizacja, kolizje, dopracowanie interakcji i nowe featury**.

---

## PRIORYTET 1: KRYTYCZNE BUGI I REGRESJE

### 1.1 Metronom — błąd referencji `i` w callbacku
W `AudioEngine.js` linia 222:
```js
this.metronomeSynth.triggerAttackRelease(value.note, "32n", time, i % 4 === 0 ? 0.5 : 0.25);
```
Zmienna `i` pochodzi z pętli `for` wyżej — w callbacku `Tone.Part` jest **undefined** (lub wskazuje na ostatnią wartość z closure). To powoduje crash lub nierówną głośność klików.
**→ Zamień `i % 4 === 0` na logikę bazującą na `value`, np. dodaj `isDownbeat: i % 4 === 0` do obiektu event i użyj `value.isDownbeat ? 0.5 : 0.25`.**

### 1.2 Piano Roll — klawisze nie scrollują się synchronicznie z siatką
Piano Keys (`w-14 overflow-y-auto`) i Grid (`flex-1 overflow-auto`) mają **osobne scrolle Y**. Kiedy user scrolluje siatkę w pionie, klawisze pozostają nieruchome i nuty "rozjeżdżają się" względem klawiszy.
**→ Zsynchronizuj scroll Y klawiszy z scrollem Y siatki.** Najczystsza metoda: jeden wspólny kontener `overflow-y-auto` obejmujący obie kolumny, lub `onScroll` handler na gridzie ustawiający `scrollTop` na klawisze via ref.

### 1.3 Piano Roll — dźwięk nutek gra dopiero po `engine.init()` (klik w stronę)
`engine.playNote()` sprawdza `if (!this.isInitialized) return;` — jeśli użytkownik otworzy Piano Roll zanim kliknie gdziekolwiek (co triggeruje `init`), preview nutek jest niesłyszalny.
**→ W `playNote()` auto-inicjalizuj engine jeśli nie jest gotowy** (dodaj `await this.init()` lub wymuś init przy otwarciu Piano Roll).

### 1.4 Bar ruler nie scrolluje się z Timeline
Pasek numerów taktów (linia 261-273 w Timeline.jsx) ma `overflow-hidden` i nie jest zsynchronizowany ze scrollem głównej siatki.
**→ Zsynchronizuj `scrollLeft` bar rulera z `timelineRef.scrollLeft`** (onScroll handler lub wspólny kontener scroll).

### 1.5 Snap selector — wartości zależą od `beatWidth` (zmieniają się z zoomem)
`snapOptions` w Timeline przeliczają wartość jako `beatWidth / N`. Przy zoom 200% snap "1/4" daje `40px` zamiast `20px`, co łamie gridSnap w store.
**→ Snap powinien być przechowywany jako mnożnik (np. `0.25`, `0.125`) a przeliczenie na piksele `snap * BASE_BEAT_WIDTH * zoom` powinno być robione przy użyciu, nie przy definicji.**

### 1.6 Context menu nie zamyka się przy kliknięciu poza nim
Context menu jest renderowany jako `fixed div`, ale jedynym sposobem zamknięcia jest kliknięcie w siatkę Timeline (warunek w `handleTimelineMouseDown`). Kliknięcie w toolbar, TrackHeaders lub gdziekolwiek indziej nie zamyka menu.
**→ Dodaj globalny `mousedown` listener (lub overlay `div`) zamykający context menu przy każdym kliknięciu poza nim.**

---

## PRIORYTET 2: KOLIZJE I INTERAKCJE (USER REQUEST)

### 2.1 🚨 Bloczki na ścieżkach mogą nakładać się na siebie
Obecnie nie ma żadnej walidacji kolizji — można położyć dwa klipy na tej samej ścieżce w tym samym miejscu. Nakładające się klipy powodują podwójny dźwięk i wizualny bałagan.
**→ Zaimplementuj collision detection na klipach:**
- **Przy rysowaniu (draw tool):** Przed `addClip()` sprawdź, czy nowy klip nie koliduje z istniejącymi na tej samej ścieżce. Jeśli tak — nie twórz klipu.
- **Przy przesuwaniu (drag):** W `onDragStop` sprawdź kolizję z innymi klipami na docelowej ścieżce. Jeśli kolizja → snap do najbliższej wolnej pozycji (przed lub za kolidującym klipem).
- **Przy resize:** W `onResizeStop` ogranicz szerokość, jeśli klip weszłby w sąsiada.
- **Logika kolizji:** dwa klipy A i B kolidują, jeśli `A.x < B.x + B.width && A.x + A.width > B.x && A.trackId === B.trackId`.

### 2.2 🚨 Nuty w Piano Roll mogą nakładać się na siebie
Tak samo jak klipy — można narysować nutę dokładnie tam, gdzie jest inna.
**→ Zaimplementuj collision detection na nutach w Piano Roll:**
- **Przy rysowaniu:** Przed dodaniem nuty sprawdź, czy na tej samej wysokości (ta sama nota) nie ma już nuty w tym zakresie czasu. Jeśli tak — nie twórz.
- **Przy przesuwaniu:** W `onDragStop` sprawdź kolizję. Jeśli kolizja — cofnij do poprzedniej pozycji.
- **Logika:** dwie nuty A i B kolidują, jeśli `A.note === B.note && A.time < B.time + B.duration && A.time + A.duration > B.time`.

### 2.3 🚨 Dźwięk nutek w Piano Roll (USER REQUEST — uzupełnienie)
Dźwięk gra przy dodawaniu nowej nuty (linia 70: `engine.playNote(...)`) i przy przesuwaniu (linia 203). Ale:
- Nie gra przy **resize** nuty (zmiana długości).
- Nie gra poprawnie, gdy engine nie jest zainicjalizowany (patrz 1.3).
- Brak dźwięku auditioning — kliknięcie na istniejącą nutę powinno ją odegrać.
**→ Dodaj `engine.playNote()` na mouseDown/click na istniejącej nucie (w trybie move). Przy resize: zagraj notę z nową długością po `onResizeStop`.**

---

## PRIORYTET 3: NOWE FEATURY

### 3.1 Loop Region (draggable markers)
Odroczone z fazy 2. Użytkownik powinien móc zaznaczyć region do zapętlenia.
**→ Dodaj do store `loopStart`/`loopEnd` (w beatach). Na bar rulerze renderuj draggowalne markery (lewy i prawy). Podświetl region kolorem (np. `rgba(52,211,153,0.08)`). Podłącz `Tone.Transport.loopStart`/`loopEnd`.**

### 3.2 Eksport WAV (Tone.Offline)
Odroczone z fazy 2. Obecny eksport to WebM (MediaRecorder).
**→ Użyj `Tone.Offline` do offline-renderowania całego projektu (odtwórz scheduling wewnątrz Tone.Offline callback). Konwertuj AudioBuffer na WAV blob (write WAV header + Float32 → Int16 PCM). Oferuj download jako `.wav`.**

### 3.3 Duplikowanie przez Alt+Drag
`duplicateClip` istnieje w store, ale jedynym sposobem użycia jest context menu. Brak Alt+Drag.
**→ W Timeline, wykryj `altKey` w `onDragStart` (react-rnd). Jeśli Alt wciśnięty — zamiast przesuwania oryginalnego klipu, stwórz kopię i przesuń ją. Oryginał zostaje na miejscu.**

### 3.4 Reorder ścieżek (drag & drop)
Ścieżki mają stałą kolejność. Nie da się ich przesunąć.
**→ Dodaj drag handle na TrackHeaders (ikona ≡). Zaimplementuj drag & drop reorder (prosty — mousedown/mousemove swap lub biblioteka `@dnd-kit`). Przy zmianie kolejności zaktualizuj tablicę `tracks` w store.**

### 3.5 Zaznaczanie wielu klipów (multi-select)
Obecny selectedClipId to single select. Nie da się usunąć kilku klipów naraz.
**→ Zamień `selectedClipId` na `selectedClipIds: Set<id>`. Ctrl+Click dodaje/usuwa z zaznaczenia. Delete usuwa wszystkie zaznaczone. Context menu działa na zaznaczeniu.**

### 3.6 Copy/Paste klipów (Ctrl+C / Ctrl+V)
Brak schowka.
**→ Dodaj do store `clipboard: Clip[]`. Ctrl+C kopiuje zaznaczone klipy. Ctrl+V wkleja je na pozycji playheada (lub z offsetem jeśli ta sama ścieżka).**

### 3.7 Piano Roll — velocity (głośność nuty)
Każda nuta gra z tą samą głośnością. Profesjonalny DAW pozwala na zmianę velocity per nuta.
**→ Dodaj `velocity: number` (0.0–1.0) do obiektu nuty. Domyślnie 0.8. W Piano Roll dodaj cienki pasek velocity pod siatką (lub zmianę jasności koloru nuty proporcjonalnie do velocity). W AudioEngine przekaż velocity jako 4. argument `triggerAttackRelease`.**

### 3.8 Track renameable inline (double-click)
Track name jest edytowalny przez zwykły `<input>`, ale nie ma wizualnego feedbacku, że to jest input (wygląda jak label).
**→ Zamień na tryb display/edit: domyślnie wyświetlaj `<span>`, po double-click zamień na `<input>` z autofocus. Blur lub Enter zamyka edycję.**

---

## PRIORYTET 4: POLISH WIZUALNY I UX

### 4.1 Piano Roll — grid nie ma numerów beatów
Siatka wewnątrz Piano Roll nie ma żadnych numerów/oznaczeń osi X. Ciężko zorientować się, który to beat.
**→ Dodaj mini-ruler nad siatką w Piano Roll z numerami beatów (1, 2, 3, 4, 1, 2...) względem klipu.**

### 4.2 Toolbar Timeline — dodaj separator sekcji i podpisy
Toolbar Timeline ma dużo elementów (transport, czas, BPM, snap, tools, zoom, metronom) ale brak wizualnych grup.
**→ Dodaj subtelne labele nad grupami (np. "TRANSPORT", "GRID", "TOOLS") oraz delikatne separatory. Rozmieść elementy bardziej czytelnie.**

### 4.3 Piano Roll — kolor tła per oktawa
Oktawy (C1-B1, C2-B2...) wyglądają identycznie — trudno odróżnić granice.
**→ Dodaj alternujące tło per oktawa (subtelna zmiana jasności co 12 nut).**

### 4.4 Empty state Timeline
Kiedy nie ma żadnych klipów, Timeline jest pusty — nie ma informacji co robić.
**→ Dodaj wycentrowaną wiadomość: "Draw clips on the timeline or press D to switch to Draw mode" z ghosted ikoną.**

### 4.5 Toast notifications
Akcje typu Save, Export, Load nie dają żadnego feedbacku oprócz pobrania pliku.
**→ Dodaj prosty system toast notifications (komponent + stan w store). Pokaż "Project saved ✓", "Project loaded ✓", "Export complete ✓" itp.**

### 4.6 Responsive TrackHeaders + Timeline sync scroll
TrackHeaders i Timeline mają niezależny scroll pionowy. Przy wielu ścieżkach, scrollowanie jednego nie scrolluje drugiego.
**→ Zsynchronizuj scrollTop TrackHeaders z scrollTop Timeline (onScroll handler + shared ref).**

---

## INSTRUKCJE DLA AGENTA

1. **PRIORYTET 1 NAJPIERW** — napraw wszystkie bugi zanim ruszysz dalej. Szczególnie **1.1** (metronom crash) i **1.2** (podwójny scroll Piano Roll).
2. **PRIORYTET 2 NATYCHMIAST PO** — kolizje klipów i nut to fundamentalny UX. Bez tego DAW jest niestabilny.
3. **Stos technologiczny jest zamknięty** — nie dodawaj nowych zależności npm bez uzasadnienia.
4. **Tailwind CSS v4** — `@import "tailwindcss"` + `@config`, NIE `@tailwind`.
5. **Fonty**: Roboto + Roboto Mono (już w `tailwind.config.js`).
6. **Testuj po każdej zmianie** — `npm run build` musi przechodzić czysto.
7. **Performance** — używaj `React.memo`, `useCallback`, `useMemo` gdzie potrzeba. 50+ klipów nie powinno lagować.
8. **Nie zmieniaj motywu wizualnego** — Subnautica theme, dark ocean palette, bioluminescencja.
