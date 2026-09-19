# Musicly — Subnautica DAW: Prompt dla Agenta (Poprawki + Rozszerzenia + UX)

## Kontekst Projektu
Musicly to przeglądarkowy klon DAW (Digital Audio Workstation) zbudowany w React + Vite + Tone.js + Zustand. Motyw wizualny jest inspirowany grą Subnautica (głębia oceanu, bioluminescencja, PDA). Projekt przeszedł już pierwszą fazę refaktoryzacji — ma Zustand store, Tailwind CSS v4, nowy AudioEngine z channel strips i podstawowy Piano Roll. Teraz potrzebuje **gruntownej fazy naprawczej i rozbudowy UX/funkcjonalności**.

---

## Stos Technologiczny (nie zmieniaj)
- React 19, Vite 5, Tone.js 15
- Zustand 5 + Zundo 2 (undo/redo)
- Tailwind CSS 4 (z `@tailwindcss/postcss`, `@import "tailwindcss"`, `@config`)
- react-rnd (drag & resize bloków/nut)
- lucide-react (ikony)

---

## CZĘŚĆ 1: KRYTYCZNE BUGI DO NAPRAWY

### 1.1 Nieużywany plik `App.css`
Plik `src/App.css` zawiera stare style z szablonu Vite (`.counter`, `.hero`, `#center`, `#next-steps` itp.). Nie jest importowany nigdzie, ale zaśmieca projekt.
**→ Usuń plik `src/App.css` całkowicie.**

### 1.2 INSTRUMENTS używają zmiennych CSS `var(--color-kick)` itp., które nie istnieją
W pliku `App.jsx` tablica `INSTRUMENTS` definiuje kolory jako `var(--color-kick)`, `var(--color-sub)` itp. Te zmienne CSS były zdefiniowane w starym `index.css` (w bloku `:root`), ale zostały usunięte po migracji na Tailwind. W efekcie kolory instrumentów nie działają — bloki na Timeline i opcje w TrackHeaders nie mają koloru.
**→ Zamień kolory w tablicy INSTRUMENTS na bezpośrednie wartości hex** (np. `'#f43f5e'` zamiast `'var(--color-kick)'`). Albo dodaj te zmienne z powrotem do `index.css` w bloku `@layer base`. Wybierz rozwiązanie bardziej spójne z Tailwind.

### 1.3 AudioEngine — synth.disconnect()/connect() race condition
W metodzie `sync()` AudioEngine, w callbacku Tone.Part:
```js
synth.disconnect();
synth.connect(value.channel);
```
To powoduje wyścig (race condition), bo jeden synth jest współdzielony między wieloma ścieżkami. Jeśli dwie nuty z różnych tracków grają ten sam instrument jednocześnie, synth jest przełączany między kanałami w trakcie dźwięku.
**→ Rozwiązanie: utwórz oddzielną instancję syntha PER TRACK (nie per instrument type).** Każdy Track powinien mieć własną kopię syntha przypisanego instrumentu, podłączoną na stałe do swojego Tone.Channel. Kiedy użytkownik zmienia instrument na ścieżce, stary synth jest dispose()'owany i tworzony nowy.

### 1.4 AudioEngine `sync()` wywołuje się PRZY KAŻDEJ zmianie stanu Zustand
`useStore.subscribe()` odpala callback przy absolutnie każdej zmianie stanu (w tym zmiana `activeTool`, `selectedClipId`). To powoduje niepotrzebne niszczenie i odtwarzanie `Tone.Part` przy kliknięciach UI.
**→ Dodaj selektor lub shallow compare, aby `sync()` wywoływał się TYLKO gdy zmieniły się `tracks`, `clips` lub `bpm`.** Użyj np. `subscribeWithSelector` middleware z zustand albo ręcznego porównania.

### 1.5 `Math.random()` w renderze Timeline powoduje migotanie
W Timeline.jsx, miniaturka nut w klipie używa `Math.random() * 8` do pozycji pionowej. Ponieważ jest w JSX renderze, każdy rerender generuje nowe losowe wartości, co powoduje migotanie.
**→ Zamień na deterministyczną funkcję bazującą na indexie nuty** (np. `(i * 7) % 10`).

### 1.6 Brak obsługi scroll'a myszką na Timeline
Stary Timeline miał obsługę `wheel` event do horyzontalnego scrollowania. W nowym kodzie to zostało usunięte.
**→ Dodaj z powrotem obsługę `wheel` event**: jeśli `deltaY !== 0 && deltaX === 0`, zamień na horyzontalny scroll.

### 1.7 `isPlaying` żyje w React state (`App.jsx`) zamiast w storze Zustand
Powoduje to niekonsystencję — reszta stanu jest w Zustand, ale `isPlaying` przechodzi propsami.
**→ Przenieś `isPlaying` do store'a Zustand** i wyeliminuj propsy `isPlaying`, `onPlayToggle`, `onReplay` z Timeline. Niech Timeline bezpośrednio czyta i modyfikuje stan.

---

## CZĘŚĆ 2: POPRAWKI UX (User Experience)

### 2.1 Brak wizualnego feedbacku na klipach — nie wiadomo jakiego są instrumentu
Klipy na Timeline wyglądają identycznie (ten sam gradient, tekst "CLIP"). Użytkownik nie wie, który klip należy do jakiej ścieżki ani jaki instrument gra.
**→ Koloruj klipy kolorem instrumentu przypisanego do ścieżki.** Wyświetlaj nazwę instrumentu (skróconą) na klipie zamiast "CLIP". Dodaj subtelny pasek koloru po lewej stronie klipu (accent bar).

### 2.2 TrackHeaders nie mają kolorowego wskaźnika
Każda ścieżka wygląda identycznie. Nie widać na pierwszy rzut oka, który instrument jest przypisany.
**→ Dodaj kolorowy pasek (4px) po lewej stronie każdego nagłówka ścieżki**, odpowiadający kolorowi instrumentu. Dodaj też mały kolorowy dot obok nazwy instrumentu w select'cie.

### 2.3 Brak numeru beatu / taktu nad Timeline
Użytkownik nie ma żadnego odniesienia czasowego na Timeline — nie wie, który to takt.
**→ Dodaj pasek z numerami taktów (Bar Numbers) nad siatką Timeline** (1, 2, 3, 4...). Każdy takt = 4 beaty = 4 × BEAT_WIDTH. Pasek powinien scrollować się razem z Timeline.

### 2.4 Brak tooltipów na przyciskach narzędzi
Przyciski w toolbarze (Move, Draw, Erase) to same ikony bez żadnego opisu.
**→ Dodaj atrybuty `title` do wszystkich przycisków-ikon** z opisem działania (np. "Move Tool (V)", "Draw Tool (D)", "Erase Tool (E)").

### 2.5 Brak skrótów klawiszowych
Profesjonalny DAW powinien mieć skróty klawiaturowe.
**→ Zaimplementuj globalny `useEffect` z `keydown` listener:**
- `Space` → Play/Pause
- `V` → Move Tool
- `D` / `B` → Draw Tool
- `E` → Erase Tool
- `Ctrl+Z` → Undo
- `Ctrl+Shift+Z` / `Ctrl+Y` → Redo
- `Delete` / `Backspace` → Usuń zaznaczony klip
- `Escape` → Zamknij Piano Roll (jeśli otwarty)
- `Home` → Replay (przewiń na początek)

### 2.6 Piano Roll — brak informacji o kontekście
Kiedy Piano Roll się otwiera, nie wiadomo jakiego instrumentu dotyczy ani jakiej ścieżki.
**→ Dodaj w headerze Piano Roll: nazwę ścieżki, nazwę instrumentu z kolorowym badge'em**, i pozycję klipu na timeline (takt:beat).

### 2.7 Piano Roll — nuty nie są ograniczone do długości klipu
Użytkownik może rysować nuty poza zakresem klipu, co nie ma sensu.
**→ Ogranicz szerokość area w Piano Roll do `clip.width`** (z niewielkim marginesem). Nuty nie powinny wychodzić poza granice klipu.

### 2.8 Brak wizualnego zaznaczenia aktywnego klipu
Po kliknięciu na klip, nic go nie wyróżnia wizualnie.
**→ Dodaj podświetlenie (jasny border + glow) do zaznaczonego klipu** (ten, którego `id === selectedClipId`).

### 2.9 Brak potwierdzenia przy usuwaniu ścieżki
Kliknięcie małej ikonki kosza na TrackHeader natychmiast usuwa ścieżkę i wszystkie jej klipy bez ostrzeżenia.
**→ Dodaj prosty modal potwierdzenia** ("Czy na pewno chcesz usunąć ścieżkę '{name}' i wszystkie jej klipy?").

### 2.10 Volume slider nie pokazuje wartości
Fadery Volume i Pan w TrackHeaders to gołe slidery — nie wiadomo, jaka jest aktualna wartość.
**→ Dodaj tooltip on hover lub mały label** wyświetlający wartość (np. "-12 dB", "L 30%").

---

## CZĘŚĆ 3: ROZSZERZENIA FUNKCJONALNOŚCI

### 3.1 Zoom na Timeline
Obecnie nie da się przybliżyć ani oddalić osi czasu.
**→ Dodaj zoom in/out:** Ctrl+Scroll zmienia `BEAT_WIDTH` (lub mnożnik zoom). Dodaj też przyciski +/- w toolbarze. Zakres zoomu: 0.25x – 4x. Zoom powinien wpływać na szerokość siatki, klipów i playheada.

### 3.2 Grid Snap selector
Snap jest na sztywno ustawiony na 20px (1/4 beatu).
**→ Dodaj dropdown w toolbarze** pozwalający wybrać snap: "1/4", "1/8", "1/16", "1/32", "Off". Wartości przeliczaj jako frakcje BEAT_WIDTH.

### 3.3 Loop Region
Użytkownik powinien móc zaznaczyć region do zapętlenia.
**→ Dodaj kontrolki loop start / loop end** (draggowalne markery na pasku taktów). Ustaw `Tone.Transport.loopStart` i `Tone.Transport.loopEnd` odpowiednio.

### 3.4 Metronom
Brak wizualnego lub dźwiękowego metronoma.
**→ Dodaj przycisk toggle metronoma** w toolbarze. Kiedy aktywny, odtwarzaj subtelny klik na każdy beat (Tone.js `Tone.PluckSynth` lub `Tone.Synth` z krótkim envelope).

### 3.5 Duplikowanie klipów
Nie da się skopiować klipu.
**→ Alt+Drag na klipie powinno tworzyć duplikat** (deep copy z nowymi id'kami nut). Dodaj też opcję w context menu (prawy klik).

### 3.6 Context Menu na klipie
Brak menu kontekstowego.
**→ Prawy klik na klipie powinien otwierać dropdown** z opcjami: "Edit (Piano Roll)", "Duplicate", "Delete", "Change Color".

### 3.7 Wizualizacja poziomu dźwięku (VU Meter)
Brak jakiegokolwiek feedbacku, że dźwięk w ogóle gra.
**→ Dodaj prosty VU meter (animowany pasek) na każdym TrackHeader**, używając `Tone.Meter` podłączonego do Tone.Channel ścieżki. Odświeżaj `requestAnimationFrame`.

### 3.8 Master Volume w Topbar
Brak globalnej kontroli głośności.
**→ Dodaj Master Volume slider w prawej części Topbar** z ikoną głośnika. Kontroluj `effects.masterGain.gain`.

### 3.9 Eksport do WAV (nie WebM)
Obecny eksport to WebM (MediaRecorder). Profesjonalny DAW eksportuje WAV.
**→ Użyj `Tone.Offline` do renderowania projektu offline**, a następnie konwertuj AudioBuffer na WAV blob. To daje czysty, stratny format audio bez zależności od MediaRecorder.

### 3.10 Wyświetlanie aktualnego czasu odtwarzania
Nie widać nigdzie, w którym miejscu jest playhead (czas/takt).
**→ Dodaj wyświetlacz czasu w toolbarze** w formacie `BAR:BEAT:TICK` (np. `003:02:000`), aktualizowany przez `requestAnimationFrame` podczas odtwarzania.

---

## CZĘŚĆ 4: USPRAWNIENIA WIZUALNE (SUBNAUTICA POLISH)

### 4.1 Animowane tło — cząsteczki oceaniczne
Obecne tło to statyczny SVG circle w pseudo-elemencie. Jest niewidoczne i nijakie.
**→ Zaimplementuj animowane tło CSS-only** z wieloma "bąbelkami" unoszącymi się do góry (keyframes, różne delays i wielkości). Lub użyj subtle floating particles z CSS animation. Powinno być delikatne, nie rozpraszające, ale widoczne.

### 4.2 Klipy powinny mieć efekt "waveform"
Klipy wyglądają jak puste prostokąty.
**→ Dodaj fake waveform wewnątrz klipu** — wygeneruj SVG path (sinusoida/szum) jako dekorację w tle klipu. Może to być deterministyczny pattern bazujący na id klipu.

### 4.3 Playhead powinien mieć glow animation
Playhead jest statyczny wizualnie.
**→ Dodaj pulsujący glow na playheadzie** (CSS animation na `box-shadow`, delikatne pulsowanie co 1s).

### 4.4 Przejście otwierania Piano Roll
Piano Roll pojawia się nagle (instant mount).
**→ Dodaj animację wejścia**: fade in + slide up (CSS transition lub Tailwind animate). Zamykanie: fade out.

### 4.5 Hover na klawiszach Piano Roll
Klawisze piano mają basic hover, ale brak wizualnego rozróżnienia oktaw.
**→ Koloruj tło klawiszy: C zawsze lekko podświetlone** (orientacja oktawowa). Dodaj ciemniejszy kolor dla klawiszy #/b. Dodaj nazwy nut tylko na klawiszach C (C1, C2, C3...) a resztę puste, żeby nie zaśmiecać.

---

## CZĘŚĆ 5: INSTRUKCJE DLA AGENTA

1. **Najpierw napraw wszystkie bugi z Części 1** — aplikacja musi działać stabilnie zanim zaczniemy dodawać nowe rzeczy.
2. **Następnie wdróż poprawki UX z Części 2** — te zmiany mają największy wpływ na użyteczność.
3. **Potem rozszerzenia z Części 3** — priorytet: skróty klawiszowe > zoom > grid snap > reszta.
4. **Na koniec polish wizualny z Części 4**.
5. **Zachowaj pełną kompatybilność z Tailwind CSS v4** — używaj `@import "tailwindcss"` i `@config`, NIE `@tailwind base/components/utilities`.
6. **Nie dodawaj nowych zależności npm** bez uzasadnienia. Staraj się rozwiązywać problemy z tym co jest.
7. **Każdy komponent powinien być dobrze skomentowany** — opisuj nie co robi linia kodu, ale DLACZEGO tak jest zaprojektowana.
8. **Testuj po każdej większej zmianie** — uruchom `npm run build` żeby upewnić się, że się kompiluje.
9. **Dbaj o performance** — nie renderuj niepotrzebnie (React.memo, useCallback). Timeline z 50+ klipami nie powinien lagować.
