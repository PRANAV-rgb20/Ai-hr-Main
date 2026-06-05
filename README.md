# Lumen HR — Workforce Operations OS

Lumen HR is a modern, full-stack Workforce Operations Operating System designed to handle standard HR workflows (Attendance, Leave, Payroll) while supercharging them with advanced Artificial Intelligence and Machine Learning models.

This document serves as the comprehensive guide to the project's architecture, features, and underlying technology.

---

## 🚀 Live Demo & Judge's Guide
If you are evaluating this project, you can test the entire platform without setting anything up! Because the application uses **Strict Role-Based Access**, you will need to log in as different users to see the different features (e.g., you cannot see the AI Resume Screener unless you log in as the Recruiter or Admin).

**Live Website URL:** [https://ai-hr-main-3419.vercel.app/](https://ai-hr-main-3419.vercel.app/)

Please use the following pre-configured credentials to explore the different dashboards:

| Role | Email | Password | What to test |
| :--- | :--- | :--- | :--- |
| **Admin** (God Mode) | `admin@hrms.com` | `Admin@123` | Can see and override everything. Test the Analytics Dashboard, Audit Logs, and Global AI features. |
| **Manager** (Team Leader) | `manager@hrms.com` | `Manager@123` | Test the **AI Attrition Risk predictor** and **Sentiment Pulse** to check the health of their specific team. |
| **Recruiter** (Hiring) | `recruiter@hrms.com` | `Recruiter@123` | Test the **AI Resume Screener** (upload a PDF) and the **AI Interview Room** (simulates a tech interview). |
| **Employee** (Standard) | `employee1@hrms.com` | `Employee@123` | Test the daily clock-in/out, request leave, and ask the **AI Policy Chatbot** questions. |

*(Note: The very first time you log in, it may take ~60 seconds to load because the backend Render server is cold-booting the AI models. All clicks after that will be lightning fast!)*

---

## 1. System Architecture & Tech Stack

The application uses a decoupled **Client-Server Architecture**. The frontend (visual interface) and backend (data/logic) are completely separate systems that communicate securely over REST APIs.

### 🔴 The Frontend (User Interface)
* **Framework:** React.js
* **Styling:** Tailwind CSS (for modern, responsive, and customizable designs)
* **State Management:** Zustand (a lightweight state manager to handle user logins and UI states)
* **API Client:** Axios (used to send HTTP requests to the backend)
* **Hosting:** Vercel (Globally distributed Edge Network for lightning-fast webpage delivery)

### 🔵 The Backend (Brain & API)
* **Framework:** FastAPI (Python) - Chosen for its extreme speed and native support for asynchronous programming (async/await), which is critical when waiting for slow AI models to respond.
* **Database:** PostgreSQL hosted on **Neon** (a modern, serverless SQL database).
* **ORM:** SQLAlchemy with Asyncpg (Translates Python code into raw SQL queries automatically).
* **Caching:** Redis hosted on **Upstash** (Stores frequently accessed data, like dashboard statistics, in memory so the database doesn't get overloaded).
* **Authentication:** JWT (JSON Web Tokens) with bcrypt password hashing.
* **Hosting:** Render (Cloud platform for running Python server containers).

### 🟢 How The Website Works (Data Flow)
1. A user clicks a button (e.g., "Sign In" or "Analyze Resume") on the React frontend.
2. `Axios` packages the data and sends a secure `POST` request over the internet to the live backend URL (`https://ai-hr-main.onrender.com/api/v1`).
3. The FastAPI backend receives the request and connects to the **Neon PostgreSQL** database to verify data or fetch records.
4. If an AI route is called, the backend securely contacts cloud LLMs or runs local Machine Learning models in memory.
5. FastAPI formats the final result, saves necessary caching states in **Redis**, and sends JSON data back to React.
6. React updates the screen instantly with the results.

---

## 2. Role-Based Access Control (RBAC)

The interface transforms completely depending on the user's role. 

### A. The Employee (Self-Service)
* **What they see:** A simple dashboard to manage their own life.
* **Features:** Live clock in/out for daily attendance, view personal leave balances, submit Time Off requests, view/download monthly Payslips, and check their own Performance Reviews.

### B. The Manager (Team Leader)
* **What they see:** A dashboard focused strictly on the people that report to them.
* **Features:** View profiles of their specific team members, see today's team attendance, approve or reject leave requests from their team, and write performance reviews.
* **AI Access:** They can use the **Attrition Risk AI** and **Sentiment Pulse AI** specifically to check the health and morale of their own team.

### C. The Recruiter (Hiring)
* **What they see:** A dashboard strictly dedicated to the hiring pipeline.
* **Features:** Create new Job Postings, manage the Candidate Kanban board (moving candidates from "Applied" -> "Interviewing" -> "Hired").
* **AI Access:** Full access to the **AI Resume Screener** and the **AI Interview Room** to automate candidate screening.

### D. The Admin (Global Override)
* **What they see:** The God-mode view of the entire company.
* **Features:** View/edit every employee in the system, create Departments, view company-wide attendance, run global Payroll, and manage system settings.
* **AI Access:** Absolute access to every AI module across the entire company.

---

## 3. The Artificial Intelligence & Machine Learning Engines

We use a sophisticated fallback chain through OpenRouter, combined with local offline mathematical models running directly on the server.

### ☁️ The Cloud LLMs (via OpenRouter)
1. **`openai/gpt-oss-120b:free` (Primary "Smart" Model):** The heavy lifter. Assigned to handle complex reasoning tasks, specifically the **AI Interview Bot** and deep **Resume Screening** analysis.
2. **`google/gemma-4-31b-it:free` (The "Fast" Model):** Assigned to handle quick, structured tasks (like rapidly formatting JSON data) where speed is more important than deep reasoning.
3. **`moonshotai/kimi-k2.6:free`:** Hardcoded to run the **HR Policy Chatbot**, answering employee questions about the company handbook.
4. **`nvidia/nemotron-3-ultra-550b-a55b:free`:** The absolute fallback. If the other three go offline, the system code automatically routes requests to Nvidia Nemotron so the app never crashes.

### 💻 The Local Offline Models (Running natively on Python)
1. **`en_core_web_sm` (by spaCy):** A lightweight Natural Language Processing model. It does not use the internet. Used strictly during Resume Screening to rapidly rip out physical nouns (Names, Dates, Companies) before the text is sent to the LLM.
2. **`Random Forest Classifier` (by Scikit-Learn):** A pure mathematical Machine Learning algorithm. It calculates the 1-100% **Attrition Risk**. It takes raw data (salary, hours, age) and runs it through a massive mathematical decision tree to predict if someone will quit.
3. **`sentence-transformers` (by HuggingFace):** Runs the **Sentiment Pulse**. Converts anonymous employee feedback paragraphs into mathematical vectors to gauge whether a sentence is angry, happy, or stressed.

---

## 4. Local Development

**1. Clone the repository**
```bash
git clone https://github.com/PRANAV-rgb20/Ai-hr-Main.git
```

**2. Start the Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # (or .venv\Scripts\activate on Windows)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**3. Start the Frontend**
```bash
cd frontend
npm install --legacy-peer-deps
npm start
```
