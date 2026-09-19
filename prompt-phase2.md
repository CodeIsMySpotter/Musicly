# Musicly - Faza 2: Sound Design & Mixing Engine

Jako zaawansowany AI agent specjalizujący się w aplikacjach React i Web Audio API (Tone.js), twoim zadaniem jest gruntowna rozbudowa architektury dźwiękowej aplikacji Musicly. Aplikacja posiada już solidne fundamenty aranżacyjne (Timeline, Piano Roll, Clip Management, Multi-select, Export). 

Głównym celem obecnej fazy jest danie użytkownikowi pełnej kontroli nad kreowaniem brzmienia, na wzór profesjonalnych programów DAW (Ableton Live, FL Studio, Logic Pro). Zachowaj obecny styl wizualny (Subnautica-inspired, dark mode, glassmorphism) i zadbaj o wysoką wydajność komponentów.

Oto wykaz funkcjonalności do wdrożenia w kolejności priorytetów:

## PRIORYTET 1: ROZBUDOWA ARCHITEKTURY DŹWIĘKU I BAZY INSTRUMENTÓW
Obecnie aplikacja posiada tylko kilka sztywno zdefiniowanych syntezatorów. Należy to zmienić.
- [ ] **1.1 Obsługa Samplera (Próbki Audio)**: Zintegruj `Tone.Sampler` w `AudioEngine`. Oprócz syntezatorów generujących dźwięk matematycznie, chcemy mieć wsparcie dla gotowych paczek sampli (np. akustyczne bębny, prawdziwe pianino, gitara). Przygotuj mockową architekturę do ładowania plików `.wav`/`.mp3` dla poszczególnych klawiszy.
- [ ] **1.2 Znaczne rozszerzenie bazy presetów**: Dodaj minimum 10 nowych, zróżnicowanych brzmień (np. Pluck, Reese Bass, FM Bell, 808, Lo-Fi Keys, Choirs).
- [ ] **1.3 Panel Edycji Instrumentu (Synth Editor)**: Dodaj nowy modal / panel dolny, który otwiera się po kliknięciu w ikonę instrumentu na ścieżce. Powinien pozwalać na manipulację parametrami w czasie rzeczywistym:
    - Zmiana fali oscylatora (Sine, Square, Saw, Triangle).
    - Kontrola obwiedni ADSR (Attack, Decay, Sustain, Release) za pomocą wizualnych suwaków lub pokręteł (knobs).
    - Te dane muszą być trzymane w store (Zustand) dla każdej ścieżki i odpowiednio aplikowane w `AudioEngine`.

## PRIORYTET 2: SYSTEM MIKSOWANIA I EFEKTÓW (FX)
Obecnie Reverb i Delay nałożone są globalnie i "na sztywno" – musimy dać użytkownikowi możliwość odpinania ich i dodawania własnych.
- [ ] **2.1 Globalny Panel Masteringu**: Utwórz dedykowany panel "Master Rack", pozwalający włączać, wyłączać i modyfikować parametry globalnego echa (Reverb) i opóźnienia (Delay). Dodaj kontrolki "Dry/Wet" oraz "Decay Time".
- [ ] **2.2 Efekty na pojedynczych ścieżkach (Track Inserts)**:
    - Każdy track powinien obsługiwać własny, niezależny łańcuch FX (maksymalnie np. 3-4 sloty na ścieżkę).
    - Zaimplementuj obsługę podstawowych efektów: `EQ3` (Korektor trójpasmowy: Low/Mid/High), `Distortion`, `Chorus` oraz `BitCrusher`.
    - `AudioEngine` musi dynamicznie przepinać łańcuch sygnału `Tone.js`, gdy użytkownik doda lub usunie efekt z danego kanału.
- [ ] **2.3 Widok Miksera (Mixer View)**:
    - Zaimplementuj wysuwany od dołu widok (toggle np. pod klawiszem `M` lub przyciskiem w UI).
    - Mikser powinien wyświetlać klasyczne "kanały" (channel strips) dla każdej ścieżki: głośność (fader pionowy), wskaźnik Peak Meter, Panoramę (pionowe pokrętło L/R) oraz sloty na wtyczki FX z możliwością ich włączania/wyłączania.

## PRIORYTET 3: EKSPRESJA I AUTOMATYKA
Aby muzyka brzmiała żywo, potrzebujemy automatyki – możliwości sterowania parametrami w czasie.
- [ ] **3.1 Automatyka parametrów (Automation Lanes)**:
    - Dodaj pod każdą ścieżką rozwijaną "ścieżkę automatyki" (wzorowane na Abletonie).
    - Użytkownik powinien móc narysować węzły (nodes) połączone linią na osi czasu.
    - Automatyka powinna móc sterować np. filtrem (Filter Cutoff) lub głośnością w czasie (Fade In / Fade Out). Wymaga to użycia harmonogramowania wartości w `Tone.js` (np. `rampTo` w odpowiednich momentach).
- [ ] **3.2 Ulepszenia Piano Roll**:
    - **Ghost Notes**: Wyświetlanie w tle Piano Rolla wyszarzonych, nieedytowalnych nut z innych ścieżek. Niezbędne do łatwego układania harmonii i akordów.
    - **Note Length Snap**: Pamiętanie ostatniej użytej długości nuty przy rysowaniu nowej.

## WSKAZÓWKI ARCHITEKTONICZNE DLA AGENTA:
1. Pamiętaj o asynchroniczności Tone.js. Przed manipulacją węzłami efektów (dodanie/usunięcie), zawsze ostrożnie zarządzaj metodami `.connect()` i `.disconnect()`, żeby nie wyciszyć sygnału permanentnie.
2. Używaj Zustand do przechowywania struktury efektów: np. `track.fx = [{ id: 'fx1', type: 'reverb', wet: 0.5 }, ...]`.
3. Komponenty UI dla potencjometrów (Knobs) i suwaków zrób we wspólnym katalogu (wielokrotnego użytku). UI ma być zachwycające, używaj płynnych CSS transitions i świecących akcentów wzorowanych na morskiej estetyce.
4. Uważaj na wydajność przy Peak Meters (Miernikach głośności) - aktualizuj je w pętli `requestAnimationFrame`, a nie poprzez stan w React, aby uniknąć zbędnych re-renderów całego miksera.
