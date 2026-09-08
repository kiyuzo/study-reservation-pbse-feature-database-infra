## **PERSON 1 — Database + App Infrastructure** 

### **Own these files** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `service/` ├── .env.example ├── db/ │   ├── schema.sql │   └── seed.sql ├── src/ │   └── app.js └── service/README.md 



<!-- Start of picture text -->
<br><!-- End of picture text -->

###  **Responsibilities** 

#### **Database** 

- Design `schema.sql` 

- Create all required tables 

- Make sure DB can be created from empty state 

- Create `seed.sql` 

- Make sample data for demo 

- Include idempotency-key table/storage 

The assignment requires the DB structure to be committed and all SQL to live in the `store/` layer for queries; `schema.sql` contains the table definitions. 

#### **Application infrastructure** 

- Express/app setup 

- Load environment variables 

- Configuration checks 

- Register routes 

- Global error handler hookup 

- `/health` 

- Server startup 

`app.js` is specifically described as the assembly point for routes, error handling, and config checks. 

#### **README** 

- Copy operation list from `openapi.yaml` 

- Track: 

   - `DONE` 

   - `IN PROGRESS` 

   - `MOCK` 

- Add deployment URL later 

The assignment explicitly requires the operation-status table in `service/README.md` . 

### 🚫 **Person 1 should NOT touch** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `src/routes/ src/schemas/ src/store/ src/representations/ src/problem.js` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

# **PERSON 2 — Study Room Resource** 

If your domain is still the **study-room reservation system** , this person owns the entire **Room resource** . 

### **Own these files** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `src/` ├── routes/rooms.js ├── schemas/rooms.js ├── store/rooms.js └── representations/rooms.js 

`tests/` └── contract/rooms.test.js 



<!-- Start of picture text -->
<br><!-- End of picture text -->

###  **Responsibilities** 

Implement: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `GET /v1/rooms/{id} GET /v1/rooms` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 Including: 

### **1. Route** 

Connect: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `GET /v1/rooms/{id} GET /v1/rooms` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 to handlers. 

### **2. Validation** 

- Validate `room_id` 

- Validate query parameters 

- Follow the schema **exactly from** **`openapi.yaml`** 

Malformed ID → `400` , not `404` . 

### **3. Database work** 

All SQL goes inside: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

- `store/rooms.js` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

###  **4. Representation** 

Never return raw DB rows. 

Instead: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `DB row` 

- `↓` 

```
representations/rooms.js
```

- `↓` 

```
API response
```



<!-- Start of picture text -->
<br><!-- End of picture text -->

- The assignment explicitly requires one representation function per resource. 

### **5. Response handling** 

Make sure documented statuses can actually happen. 

Also implement collection behavior: 

- `no rooms → 200 + []` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

O 

O 

O 

sg 

U 

O 

O 

O 

- reservation lookup 

- status/domain rules 

- conflict checking 

- `400` 

- `422` 

- `409` 

- `201` 

- `Location` header 

- returning created reservation representation 

The assignment requires the service to distinguish: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `400 → malformed request 422 → individually valid but unusable request 409 → valid request rejected by current domain state` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

# **PERSON 4 — Cross-Cutting Errors + Idempotency + Testing + Deployment** 

This one sounds broad, BUT it's intentionally separated from the resource implementation. 

### **Own these files** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `src/` ├── problem.js └── store/idempotency.js 

```
tests/
```

├── contract/ └── idempotency/ 

```
docs/
```

└── decisions/ └── 0002-implementasi.md 

```
.github/
```

└── workflows/ └── ... 



<!-- Start of picture text -->
<br><!-- End of picture text -->

###  **1.** **`problem.js`** 

#### Create **one standardized error function** . 

For example: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `problem({ status, type, title, detail, instance })` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 Every failure should become: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `Content-Type: application/problem+json` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 The assignment explicitly requires a single function producing the API's failure shape. 

### **2. Idempotency** 

This is VERY important because it's one of the main grading points. 

Person 4 implements the server-side mechanism: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `Idempotency-Key` 

```
        ↓
check database
```

```
        ↓
```

┌──────────────────────────────┐ │ never seen                   │ │ → process request             │ │ → save key + body hash        │ │ → save response               │ └──────────────────────────────┘ 

```
already seen + same body
```

```
→ return saved 201 response
```

```
already seen + different body
→ 409
```



<!-- Start of picture text -->
<br><!-- End of picture text -->

 This exact decision order is required by the assignment. 

#### And **the key must be stored in the database, not memory** . 

Person 3 will **call** Person 4's idempotency functions from `reservations.js` . 

So: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `Person 3 reservations.js` 

```
       ↓
Person 4
idempotency.js
       ↓
```

```
database
```



<!-- Start of picture text -->
<br><!-- End of picture text -->

 No one needs to edit the same file. 

### **3. Contract tests** 

Person 4 owns: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `tests/contract/` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 Test: 

- successful responses 

- malformed IDs 

- missing entities 

- empty collections 

- invalid body 

- 422 cases 

- 409 cases 

- response schemas 

- headers 

- idempotency 

The assignment requires contract conformance testing against the running service and recommends running it on every push through CI. 

### **4. Decision record** 

Person 4 creates: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `docs/decisions/0002-implementasi.md` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

####  with: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `Context Decision Alternatives considered Consequences` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

####  covering: 

- hosting provider 

- idempotency storage 

- any deviation from required structure 

# **THE FINAL DIVISION IS** 

#### **Person Main Area Files** 

|**P1**|DB +<br>Infrastructure|`schema.sql`,`seed.sql`,`.env.example`,`app.js`, README|
|---|---|---|
|**P2**|Study Room|`routes/rooms.js`,`schemas/rooms.js`,`store/rooms.js`,<br>`representations/rooms.js`, room tests|
|**P3**|Reservation|`routes/reservations.js`,`schemas/reservations.js`,<br>`store/reservations.js`,<br>`representations/reservations.js`, reservation tests|
|**P4**|Errors +<br>Idempotency +<br>CI|`problem.js`,`store/idempotency.js`,<br>contract/idempotency tests, CI, decision record|



# **WHO CAN EDIT WHAT?** 

Make this rule for your team: 

### **P1 owns** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `db/* service/.env.example src/app.js service/README.md` 

###  **P2 owns** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `src/routes/rooms.js src/schemas/rooms.js src/store/rooms.js src/representations/rooms.js tests/contract/rooms.test.js` 

###  **P3 owns** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `src/routes/reservations.js src/schemas/reservations.js src/store/reservations.js src/representations/reservations.js tests/contract/reservations.test.js` 

###  **P4 owns** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `src/problem.js src/store/idempotency.js tests/contract/* tests/idempotency/* docs/decisions/* .github/*` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

####  **Nobody casually edits another person's files.** 

# **2 DEPENDENCIES** 

### **Dependency 1 — P3 ↔ P4** 

Reservation creation needs idempotency. 

So agree beforehand that P4 exposes something like: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `checkIdempotencyKey(...) saveIdempotencyResult(...)` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 P3 only **calls** those functions. 

### **Dependency 2 — P1 ↔ Everyone** 

Everyone needs the database schema. 

So **P1 should create the initial** **`schema.sql` first** , then freeze the table structure unless the team discusses a change. 

If P2/P3 discovers they genuinely need a schema change: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 ❌ directly modify schema.sql 

✅ tell P1 `↓ team agrees ↓ P1 updates schema.sql` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 This avoids three people simultaneously changing the DB. 

# **GIT STRATEGY** 

Since the assignment says **each member must commit using their own Git identity** , this is actually important for grading. 

Use: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `main` │ ├── feature/database-infra       ← P1 ├── feature/rooms                ← P2 ├── feature/reservations         ← P3 └── feature/errors-idempotency   ← P4 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 Each person: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `git checkout -b feature/rooms` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 then commits using their own Git identity. 

**Don't have everyone commit directly to** **`main` .** 

# **WORK ORDER** 

Don't literally wait for the whole thing to finish before integrating. Do this: 

### **STEP 1 — P1** 

Create DB + app skeleton. 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `schema.sql seed.sql app.js .env.example` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 

### **STEP 2 — P2 + P3 + P4 work in parallel** 



<!-- Start of picture text -->
<br><!-- End of picture text -->

**** `P2 → rooms P3 → reservations P4 → errors + idempotency + tests` 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 

### **STEP 3 — Integration** 

P1 connects: 



<!-- Start of picture text -->
<br><!-- End of picture text -->

 `app.js` 

```
 ↓
```

```
rooms routes
reservations routes
error handler
```



<!-- Start of picture text -->
<br><!-- End of picture text -->

- 

### **STEP 4 — Contract testing** 

P4 runs everything against the service. 

### **STEP 5 — Fix failures** 

**Important:** don't modify `openapi.yaml` just to make tests pass. The assignment explicitly says the contract is the reference; if the implementation is wrong, fix the implementation. If the contract itself is wrong, revise it deliberately and record the change. 

### **STEP 6 — Deployment** 

Then demonstrate the 3 things the grader asks for: 

1. **One read operation** served by your own deployed code. 

2. **One write operation** , then retrieve the created entity. 

3. **Same write twice with same idempotency key → exactly one entity** , and it survives restart. 

