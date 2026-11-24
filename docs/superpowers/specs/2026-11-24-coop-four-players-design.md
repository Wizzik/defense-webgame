# Co-op for 3-4 players (short design, 2026-11-24)

Petr approved this design in chat on 2026-11-24 ("Ano").

## Intent

Petr wants to play with up to three friends. The simulation already plays 1-4 heroes and `rules.coop` is tuned for 2-4 players (migration step 8), but the network layer, the lobby and the client only work for a host and one guest. This change lifts the network and client limit from 2 players to 4.

## Goals

- One link for everyone: the host sends the same `?join=<code>` link to up to three friends. Each friend joins, picks his hero (he can change it until the run starts) and wears his own gear.
- The host's lobby lists every player who joined (hero name). He chooses the course and starts once at least one guest is in. Joining after the start is refused.
- The run plays in lockstep for 2-4 windows.
- The HUD shows every teammate. The team panel already loops over all players, so it should only need a check.
- A guest who leaves: the others play on, and his hero stands still (as today).
- The host leaves: every guest loses his link to the others too. Each guest plays on alone, and the other heroes stand still in his window.
- `?debug=1&mate=a,b,c` runs a local co-op run of up to 4 heroes in one window. The autopilot steers every hero except the first.

## Non-goals

- Host migration (moving the hub to a guest when the host leaves).
- Joining a run that has already started, and spectators.
- Changing co-op balance or the rules (step 8 already tuned them for 2-4).

## Approaches

- **Star through the host (chosen).** Guests connect only to the host. The host relays each guest's inputs and hashes to the other guests, and checks every guest's hash. This means 1 WebRTC link per guest. The relay adds one hop between two guests, which fits in the 3-step (100 ms) input delay.
- Full mesh (every window linked to every other): up to 6 links, more NAT failures between players on different networks, and a harder lobby (guests must learn about each other and connect to each other). Dropped.
- Host-authoritative state sync: this throws away the deterministic lockstep and the spike's work. Dropped.

## Decided

- Protocol version 3. An input and a hash carry the player `p`. The host fills `p` in for what a guest sends (the host trusts the link, not the field: a guest cannot send for another player). The host sends `left {p}` when a guest leaves. `hello` carries the list of heroes in the room and the receiver's own player number, so every lobby can list the room.
- At most 4 players (`MAX_PLAYERS`). A 4th guest is turned away.
- Player numbers follow join order; the host is 0. The numbers are packed again at the start (a guest who left the lobby leaves no gap).

## Left to the builder

- The exact UI of the lobby list, the texts (EN and CS), and how the `left` banner names the hero who left.
- The net test with 3 headless windows in the container.
