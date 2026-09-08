# Clinic Stock — how to use it

A replacement for the vaccine stock notebook. Everything stays on the phone; no internet is needed
to use it.

Two things happen all day, and both are on the first two tabs.

---

## The whole app in one picture

```mermaid
flowchart TD
    OPEN([Open the app]) --> HOME

    HOME["<b>GIVE DOSE</b> — opens here<br/>Every vaccine as a big tile,<br/>with how many doses are left"]

    HOME -->|"A child is being vaccinated"| D1
    HOME -->|"A delivery has arrived"| S1
    HOME -->|"A new vaccine, or remove one"| V1
    HOME -->|"Reports and backup"| M1

    subgraph GIVE ["Give a dose — 2 or 3 taps"]
        direction TB
        D1["Tap the vaccine's tile"] --> D2["Batch is already chosen<br/>(change it only if wrong)"]
        D2 --> D3{"Do you have<br/>the child's name?"}
        D3 -->|Yes| D4["Tap the name,<br/>or type 2 letters to find it"]
        D3 -->|No| D5["Tap <b>Skip — no name</b>"]
        D4 --> D6(["Tap <b>GIVE 1 DOSE</b>"])
        D5 --> D6
        D6 --> D7["Stock drops straight away.<br/>Wrong tap? Tap <b>UNDO</b><br/>on the black bar."]
    end

    subgraph ADD ["Log a delivery"]
        direction TB
        S1["Open <b>ADD STOCK</b> tab"] --> S2["Tap the vaccine"]
        S2 --> S3["Type the batch number<br/>from the box"]
        S3 --> S4["Roll the wheels to the<br/>expiry month and year"]
        S4 --> S5["Bought, or Government free?"]
        S5 --> S6["Use − and + for how many<br/>vials arrived"]
        S6 --> S7(["Tap <b>ADD TO STOCK</b>"])
    end

    subgraph CAT ["Vaccines"]
        direction TB
        V1["Open <b>VACCINES</b> tab"] --> V2["<b>ADD A NEW VACCINE</b> at the bottom"]
        V1 --> V3["<b>Hide</b> — stops it showing,<br/>keeps all history"]
        V1 --> V4["<b>Remove</b> — takes it off every list.<br/>Nothing is ever erased."]
    end

    subgraph MORE ["More"]
        direction TB
        M1["Open <b>MORE</b> tab"] --> M2["<b>Given today</b> — every dose,<br/>with times and totals"]
        M1 --> M3["<b>Back up / restore</b>"]
        M1 --> M4["<b>Missing child names</b> — fill in<br/>the ones you skipped"]
        M1 --> M5["<b>All entries</b> — full history,<br/>and correct any entry"]
    end

    style HOME fill:#DBEAFE,stroke:#1D4ED8,stroke-width:2px
    style D6 fill:#DBEAFE,stroke:#1D4ED8,stroke-width:2px
    style S7 fill:#CCFBF1,stroke:#0F766E,stroke-width:2px
    style OPEN fill:#F1F5F9,stroke:#475569
```

---

## Installing it

1. Tap the link sent on WhatsApp. Let it download.
2. Android will warn that it is not from the Play Store. Choose **More details → Install anyway**.
   It asks once.
3. Open **Clinic Stock**.

## Before you rely on it — five minutes, once

1. Open the **VACCINES** tab and check **doses per vial** for every vial you actually use.
   These are only suggestions and pack sizes vary by manufacturer. **This number multiplies every
   count**, so a wrong one there makes every total wrong for that vaccine.
2. Open **ADD STOCK** and enter what is in the fridge right now, vaccine by vaccine.
3. Open **MORE → Back up / restore**, take one backup, and send it to yourself on WhatsApp — so you
   have seen it work once before you need it.

---

## The colours mean something

The tab you are on tells you which way stock is moving. **Give dose is blue and takes stock out.
Add stock is green-blue and puts stock in.** If the screen is the wrong colour, you are on the wrong
tab.

On the tiles:

| What you see | What it means |
| --- | --- |
| **18 doses** in black | Fine |
| **LOW** in amber | At or below the safety limit you set |
| **OUT** in red | None left |
| **CHECK** in red | The count went below zero — a delivery was probably not logged |

Every warning has a **word**, not only a colour.

---

## Things worth knowing

**The child's name is always optional.** Never let a missing name stop you recording a dose. Tap
**Skip — no name** and finish it later from **MORE → Missing child names**.

**Nothing is ever deleted.** Correcting an entry adds a correction next to it, so the history stays
complete. That is why **UNDO** stays available from **MORE → All entries** weeks later, not just for
the few seconds the black bar is on screen.

**A low-stock warning never blocks you.** The app will always let you record a vaccination.

**Type the batch number once per box, not once per child.** When you give a dose, the batch is
already filled in.

**Expiry is the end of the printed month.** A vial marked 03/2027 is usable through 31 March 2027,
and the app says so under the wheels.

---

## If something looks wrong

- **A number looks wrong** → **MORE → All entries** shows every entry in order. Tap
  **Correct this entry** on the wrong one. It is never too late.
- **A red message appears** → read it. It always says whether anything was saved. If it says
  *nothing was saved*, nothing was.
- **An amber bar asks you to back up** → tap **Back up**, or **Later** to be asked again tomorrow.
- **Anything else** → send a screenshot on WhatsApp. Also send a backup file if you can: it contains
  the whole picture.

---

## Backups — the one habit that matters

The phone holds the records. Back it up when the app asks.

**MORE → Back up / restore → Back up now** makes one file and offers to share it. Send it to yourself
on WhatsApp, or save it to Drive. It is small and takes seconds.

If the phone is ever lost or replaced, that file puts everything back.
