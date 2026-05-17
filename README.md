# Lattice

Lattice is a programme-first relationship orchestration platform for startup ecosystems.

## Test Accounts (Live Firebase Auth)

The application uses live Firebase Auth. Use the following credentials to test different roles and workspaces:

- **Platform Admin:** `platform.admin@lattice.demo` / `Lattice2026!platform`
- **Programme Admin:** `programme.admin.prog-1@lattice.demo` / `Lattice2026!prog-1-admin`
- **Organisation Admin:** `org.asean-founders-network.org-2@lattice.demo` / `Lattice2026!org-2`
- **Startup:** `startup.eduleap.comp-3@lattice.demo` / `Lattice2026!comp-3`
- **Mentor:** `contrib.farid-iskandar.cont-20@lattice.demo` / `Lattice2026!cont-20`
- **Service Provider:** `contrib.legalpro-my.cont-4@lattice.demo` / `Lattice2026!cont-4`
- **Partner:** `contrib.google-cloud-malaysia.cont-2@lattice.demo` / `Lattice2026!cont-2`
- **Investor:** `contrib.seedfund-my.cont-5@lattice.demo` / `Lattice2026!cont-5`

## Local Development

### 1. Install Dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../functions
pip install -r requirements.txt
```

### 2. Run Locally
Start the Firebase emulators (from the project root):
```bash
firebase emulators:start
```

Start the React frontend (in a new terminal):
```bash
cd frontend
npm run dev
```
