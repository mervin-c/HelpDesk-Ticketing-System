// ---------- Supabase connection ----------

const SUPABASE_URL = "https://ppoedvtnrlnsmingqbqd.supabase.co";
const SUPABASE_KEY = "sb_publishable_ItU-NTNi7kllbS2J9aHgVg_vlPU-8RD";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// ---------- Helpers ----------

const $ = id => document.getElementById(id);

let currentUser = null;
let tickets = [];
let currentTicket = null;

const isStaffRole = r =>
  r === "staff" || r === "admin";


function statusClass(status) {
  return {
    "Open": "open",
    "In Progress": "progress",
    "Resolved": "resolved",
    "Closed": "closed"
  }[status] || "open";
}


function badge(status) {
  return `
    <span class="badge ${statusClass(status)}">
      ${status}
    </span>
  `;
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );
}

function requesterName(t) {
  return t.student_name || "Unknown";
}


// ---------- Tickets ----------

async function loadTickets() {

  const { data, error } = await sb
    .from("tickets")
    .select(`
      *,
      student:profiles!tickets_student_id_fkey(full_name),
      assignee:profiles!tickets_assigned_to_fkey(full_name)
    `)
    .order("created_at", {
      ascending: false
    });


  if (error) {

    console.error(
      "Could not load tickets:",
      error
    );

    alert(
      "Could not load tickets: " +
      error.message
    );

    tickets = [];

  } else {

    tickets = data.map(t => ({
      ...t,

      student_name:
        t.student
          ? t.student.full_name
          : null,

      assignee_name:
        t.assignee
          ? t.assignee.full_name
          : null
    }));

  }


  render();
}


// ---------- Dashboard / Tickets ----------

function render() {

  $("totalCount").textContent =
    tickets.length;

  $("openCount").textContent =
    tickets.filter(
      t => t.status === "Open"
    ).length;

  $("progressCount").textContent =
    tickets.filter(
      t => t.status === "In Progress"
    ).length;

  $("resolvedCount").textContent =
    tickets.filter(
      t =>
        t.status === "Resolved" ||
        t.status === "Closed"
    ).length;


  // Recent Tickets
  // Only active tickets appear here.
  const recentTickets = tickets.filter(
    t =>
      t.status === "Open" ||
      t.status === "In Progress"
  );


  $("recentTable").innerHTML =
    recentTickets.slice(0, 5).map(t => `
      <tr>

        <td>#${t.id}</td>

        <td>
          ${escapeHtml(t.subject)}
        </td>

        <td>
          ${escapeHtml(requesterName(t))}
        </td>

        <td class="priority-${t.priority.toLowerCase()}">
          ${t.priority}
        </td>

        <td>
          ${badge(t.status)}
        </td>

      </tr>
    `).join("");


  renderTickets();
  renderTicketHistory();
}


function renderTickets() {

  if (!currentUser) return;


  const searchInput =
    $("search").value.toLowerCase().trim();

  const s =
    $("statusFilter").value;

  const p =
    $("priorityFilter").value;

  const a =
    $("assignFilter").value;


  const list = tickets.filter(t => {

    // Only active tickets belong here.
    const isActive =
      t.status === "Open" ||
      t.status === "In Progress";


    if (!isActive) {
      return false;
    }


    const subject =
      (t.subject || "").toLowerCase();

    const category =
      (t.category || "").toLowerCase();

    const requester =
      requesterName(t).toLowerCase();

    const ticketId =
      String(t.id).toLowerCase();


    // Search by:
    // Ticket ID
    // Subject
    // Requester name
    // Category
    const matchesSearch =
      !searchInput ||
      ticketId.includes(searchInput) ||
      subject.includes(searchInput) ||
      requester.includes(searchInput) ||
      category.includes(searchInput);


    const matchesStatus =
      !s || t.status === s;


    const matchesPriority =
      !p || t.priority === p;


    let matchesAssignment = true;


    if (a === "unassigned") {

      matchesAssignment =
        !t.assigned_to;

    }


    if (a === "mine") {

      matchesAssignment =
        t.assigned_to === currentUser.id;

    }


    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesAssignment
    );

  });


  $("ticketTable").innerHTML =
    list.length

      ? list.map(t => `
          <tr>

            <td>#${t.id}</td>

            <td>
              ${escapeHtml(t.subject)}
            </td>

            <td>
              ${escapeHtml(
        requesterName(t)
      )}
            </td>

            <td>
              ${escapeHtml(t.category)}
            </td>

            <td class="priority-${t.priority.toLowerCase()}">
              ${t.priority}
            </td>

            <td>
              ${badge(t.status)}
            </td>

            <td>
              ${escapeHtml(
        t.assignee_name || "—"
      )}
            </td>

            <td>
              <button
                class="btn"
                data-ticket="${t.id}">
                View
              </button>
            </td>

          </tr>
        `).join("")

      : `
        <tr>
          <td colspan="8" class="empty">
            No active tickets found.
          </td>
        </tr>
      `;
}


// ---------- TICKET HISTORY ----------

function renderTicketHistory() {

  if (!currentUser) return;


  const historySearch =
    $("historySearch");

  const historyNameSearch =
    $("historyNameSearch");

  const historyStatusFilter =
    $("historyStatusFilter");


  if (
    !historySearch ||
    !historyNameSearch ||
    !historyStatusFilter ||
    !$("historyTable")
  ) {
    return;
  }


  const q =
    historySearch.value.toLowerCase().trim();

  const name =
    historyNameSearch.value.toLowerCase().trim();

  const status =
    historyStatusFilter.value;


  const staff =
    isStaffRole(currentUser.role);


  const history = tickets.filter(t => {

    // Only resolved and closed tickets
    const isHistory =
      t.status === "Resolved" ||
      t.status === "Closed";


    // Students only see their own tickets.
    // Staff/admin can see all history.
    const isAllowed =
      staff ||
      t.student_id === currentUser.id;


    const subject =
      (t.subject || "").toLowerCase();

    const category =
      (t.category || "").toLowerCase();

    const requester =
      requesterName(t).toLowerCase();

    const ticketId =
      String(t.id).toLowerCase();


    // Search by ID, subject, requester, or category
    const matchesSearch =
      !q ||
      ticketId.includes(q) ||
      subject.includes(q) ||
      requester.includes(q) ||
      category.includes(q);


    // Requester name search for staff/admin
    const matchesName =
      !staff ||
      !name ||
      requester.includes(name);


    const matchesStatus =
      !status ||
      t.status === status;


    return (
      isHistory &&
      isAllowed &&
      matchesSearch &&
      matchesName &&
      matchesStatus
    );

  });


  $("historyTable").innerHTML =
    history.length

      ? history.map(t => `
          <tr>

            <td>#${t.id}</td>

            <td>
              ${escapeHtml(t.subject)}
            </td>

            <td>
              ${escapeHtml(
        requesterName(t)
      )}
            </td>

            <td>
              ${escapeHtml(t.category)}
            </td>

            <td class="priority-${t.priority.toLowerCase()}">
              ${t.priority}
            </td>

            <td>
              ${badge(t.status)}
            </td>

            <td>
              ${escapeHtml(
        t.assignee_name || "—"
      )}
            </td>

            <td>
              <button
                class="btn"
                data-history-ticket="${t.id}">
                View
              </button>
            </td>

          </tr>
        `).join("")

      : `
          <tr>
            <td colspan="8" class="empty">
              No ticket history found.
            </td>
          </tr>
        `;
}


// ---------- Views / Navigation ----------

function showView(name) {

  document
    .querySelectorAll(".view")
    .forEach(v =>
      v.classList.remove("active")
    );


  const target =
    $(name);

  if (target) {
    target.classList.add("active");
  }


  document
    .querySelectorAll(".nav button[data-view]")
    .forEach(b =>
      b.classList.toggle(
        "active",
        b.dataset.view === name
      )
    );


  const titles = {

    dashboard: [
      "Dashboard",
      "Overview of your support requests"
    ],

    tickets: [
      currentUser.role === "student"
        ? "My Tickets"
        : "All Tickets",
      "Search and manage submitted tickets"
    ],

    ticketHistory: [
      "Ticket History",
      "View resolved and closed support tickets"
    ],

    create: [
      "Create Ticket",
      "Submit a new support request"
    ],

    users: [
      "Users",
      "Create staff accounts and manage roles"
    ],

    reports: [
      "Reports",
      "How the help desk is performing"
    ],

    knowledge: [
      "Knowledge Base",
      "Quick troubleshooting guides"
    ],

    profile: [
      "Profile",
      "Manage your account information"
    ],

    ticketDetail: [
      "Ticket Details",
      "View, reply to and manage a support request"
    ]

  };


  if (titles[name]) {

    $("pageTitle").textContent =
      titles[name][0];

    $("pageSub").textContent =
      titles[name][1];

  }


  if (name === "users") {
    loadUsers();
  }


  if (name === "reports") {

    loadTickets().then(
      renderReports
    );

  }


  if (name === "ticketHistory") {

    loadTickets().then(
      renderTicketHistory
    );

  }

}


document
  .querySelectorAll(".nav button[data-view]")
  .forEach(b =>
    b.addEventListener(
      "click",
      () => showView(b.dataset.view)
    )
  );


document
  .querySelectorAll("[data-go]")
  .forEach(b =>
    b.addEventListener(
      "click",
      () => showView(b.dataset.go)
    )
  );


// ---------- Login / Register Navigation ----------

$("showRegister").addEventListener(
  "click",
  () => {

    $("loginView")
      .classList.add("hidden");

    $("registerView")
      .classList.remove("hidden");

  }
);


$("showLogin").addEventListener(
  "click",
  () => {

    $("registerView")
      .classList.add("hidden");

    $("loginView")
      .classList.remove("hidden");

  }
);


// ---------- AUTH ----------

async function startFromUser(user) {

  const {
    data: profile,
    error
  } = await sb
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();


  if (error || !profile) {

    console.error(
      "Profile load failed:",
      error
    );

    $("loginError").textContent =
      "Could not load your profile. Did you run the SQL files?";

    await sb.auth.signOut();

    return;
  }


  currentUser = {

    id: user.id,

    email: user.email,

    full_name:
      profile.full_name,

    role:
      profile.role

  };


  enterApp();
}


// ---------- LOGIN ----------

$("loginForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    $("loginError").textContent = "";


    const {
      data,
      error
    } = await sb.auth.signInWithPassword({

      email:
        $("loginEmail")
          .value
          .trim(),

      password:
        $("loginPass").value

    });


    if (error) {

      $("loginError").textContent =
        error.message;

      return;
    }


    await startFromUser(
      data.user
    );

  }
);


// ---------- REGISTER ----------

$("registerForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    $("registerError").textContent = "";


    const email =
      $("regEmail")
        .value
        .trim();


    const {
      data,
      error
    } = await sb.auth.signUp({

      email,

      password:
        $("regPass").value,

      options: {
        data: {
          full_name:
            $("regName")
              .value
              .trim()
        }
      }

    });


    if (error) {

      $("registerError").textContent =
        error.message;

      return;
    }


    e.target.reset();

    $("loginEmail").value =
      email;

    $("registerView")
      .classList.add("hidden");

    $("loginView")
      .classList.remove("hidden");


    if (data.session) {

      await sb.auth.signOut();

      alert(
        "Account created! You can log in now."
      );

    } else {

      alert(
        'Account created! Check your email to confirm it, then log in. (To skip this, turn off "Confirm email" in Supabase Authentication settings.)'
      );

    }

  }
);


// ---------- ENTER APPLICATION ----------

function enterApp() {

  $("loginPage")
    .classList.add("hidden");

  $("app")
    .classList.remove("hidden");


  $("userName").textContent =
    currentUser.full_name;


  $("profileName").value =
    currentUser.full_name;


  $("profileEmail").value =
    currentUser.email || "";


  const staff =
    isStaffRole(
      currentUser.role
    );


  // Students can create tickets
  $("navCreate")
    .classList.toggle(
      "hidden",
      staff
    );


  $("quickCreateBtn")
    .classList.toggle(
      "hidden",
      staff
    );


  // Only admins see Users
  $("navUsers")
    .classList.toggle(
      "hidden",
      currentUser.role !== "admin"
    );


  // Only admins see Reports
  $("navReports")
    .classList.toggle(
      "hidden",
      currentUser.role !== "admin"
    );


  // Assignment filter only for staff/admin
  $("assignFilter")
    .classList.toggle(
      "hidden",
      !staff
    );


  // Requester name search in history
  // only for staff/admin
  $("historyNameSearch")
    .classList.toggle(
      "hidden",
      !staff
    );


  $("navTickets").textContent =
    staff
      ? "▤ All Tickets"
      : "▤ My Tickets";


  $("updateCard")
    .classList.toggle(
      "hidden",
      !staff
    );


  if (staff) {
    loadStaffList();
  }


  loadTickets();

  showView("dashboard");

}


// ---------- LOGOUT ----------

$("logout").addEventListener(
  "click",
  async () => {

    await sb.auth.signOut();

    currentUser = null;
    tickets = [];
    currentTicket = null;


    $("app")
      .classList.add("hidden");

    $("loginPage")
      .classList.remove("hidden");


    $("loginPass").value = "";

  }
);


// ---------- CREATE TICKET ----------

$("ticketForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();


    const {
      error
    } = await sb
      .from("tickets")
      .insert({

        subject:
          $("subject")
            .value
            .trim(),

        category:
          $("category").value,

        priority:
          $("priority").value,

        description:
          $("description")
            .value
            .trim()

      });


    if (error) {

      alert(
        "Could not submit ticket: " +
        error.message
      );

      return;
    }


    e.target.reset();

    await loadTickets();

    showView("tickets");

  }
);


// ---------- SEARCH / FILTER ----------

[
  "search",
  "statusFilter",
  "priorityFilter",
  "assignFilter"
].forEach(id => {

  const element = $(id);

  if (element) {

    element.addEventListener(
      "input",
      renderTickets
    );

    element.addEventListener(
      "change",
      renderTickets
    );

  }

});


[
  "historySearch",
  "historyNameSearch",
  "historyStatusFilter"
].forEach(id => {

  const element = $(id);

  if (element) {

    element.addEventListener(
      "input",
      renderTicketHistory
    );

    element.addEventListener(
      "change",
      renderTicketHistory
    );

  }

});


// ---------- STAFF LIST ----------

async function loadStaffList() {

  const {
    data
  } = await sb
    .from("profiles")
    .select(
      "id, full_name, role"
    )
    .in(
      "role",
      ["staff", "admin"]
    )
    .order(
      "full_name"
    );


  let list = data || [];


  if (currentUser.role !== "admin") {

    list =
      list.filter(
        s =>
          s.id === currentUser.id
      );

  }


  $("detailAssignee").innerHTML =
    '<option value="">Unassigned</option>' +

    list.map(s => `

      <option value="${s.id}">

        ${s.id === currentUser.id
        ? "Me"
        : escapeHtml(s.full_name)
      }

        (${s.role})

      </option>

    `).join("");

}


// ---------- OPEN TICKET DETAILS ----------

function openTicketDetails(ticket) {

  currentTicket = ticket;

  const t = currentTicket;


  $("detailContent").innerHTML = `

    <h3>
      #${t.id} —
      ${escapeHtml(t.subject)}
    </h3>


    <div class="info-row">
      <span>Requester</span>
      <b>
        ${escapeHtml(
    requesterName(t)
  )}
      </b>
    </div>


    <div class="info-row">
      <span>Category</span>
      <b>
        ${escapeHtml(t.category)}
      </b>
    </div>


    <div class="info-row">
      <span>Priority</span>
      <b class="priority-${t.priority.toLowerCase()}">
        ${t.priority}
      </b>
    </div>


    <div class="info-row">
      <span>Status</span>
      <b>
        ${badge(t.status)}
      </b>
    </div>


    <div class="info-row">
      <span>Assigned To</span>
      <b>
        ${escapeHtml(
    t.assignee_name ||
    "Unassigned"
  )}
      </b>
    </div>


    ${t.reopen_count
      ? `
          <div class="info-row">
            <span>Reopened</span>
            <b>
              ${t.reopen_count} time(s)
            </b>
          </div>
        `
      : ""
    }


    <div
      style="
        padding-top:18px;
        line-height:1.6;
        font-size:14px
      ">

      <b>Description</b>

      <p
        style="
          margin-top:7px;
          color:var(--muted)
        ">

        ${escapeHtml(
      t.description
    )}

      </p>

    </div>


    ${t.resolution_note
      ? `
          <div
            style="
              padding-top:14px;
              line-height:1.6;
              font-size:14px
            ">

            <b>Resolution</b>

            <p
              style="
                margin-top:7px;
                color:var(--muted)
              ">

              ${escapeHtml(
        t.resolution_note
      )}

            </p>

          </div>
        `
      : ""
    }

  `;


  $("detailStatus").value =
    t.status;


  $("detailAssignee").value =
    t.assigned_to || "";


  $("detailResolution").value =
    t.resolution_note || "";


  const student =
    currentUser.role === "student";


  $("deleteCard")
    .classList.toggle(
      "hidden",
      !(student && t.status === "Open")
    );


  $("resolveCard")
    .classList.toggle(
      "hidden",
      !(student && t.status === "Resolved")
    );


  $("reopenReason").value = "";

  $("commentText").value = "";


  loadComments(t.id);

  showView("ticketDetail");

}


// ---------- ACTIVE TICKET DETAILS ----------

$("ticketTable").addEventListener(
  "click",
  e => {

    const id =
      e.target.dataset.ticket;


    if (!id) return;


    const ticket =
      tickets.find(
        t =>
          t.id === Number(id)
      );


    if (!ticket) return;


    openTicketDetails(ticket);

  }
);


// ---------- HISTORY DETAILS ----------

$("historyTable").addEventListener(
  "click",
  e => {

    const id =
      e.target.dataset.historyTicket;


    if (!id) return;


    const ticket =
      tickets.find(
        t =>
          t.id === Number(id)
      );


    if (!ticket) return;


    openTicketDetails(ticket);

  }
);


// ---------- STAFF / ADMIN UPDATE ----------

$("saveStatus").addEventListener(
  "click",
  async () => {

    if (!currentTicket) return;


    let status =
      $("detailStatus").value;


    const assignee =
      $("detailAssignee").value ||
      null;


    const note =
      $("detailResolution")
        .value
        .trim();


    if (
      status === "Resolved" &&
      !note
    ) {

      alert(
        "Please add a resolution note explaining how it was fixed."
      );

      return;
    }


    // Assigning an Open ticket
    // automatically makes it In Progress
    if (
      assignee &&
      status === "Open"
    ) {

      status = "In Progress";

    }


    const {
      data,
      error
    } = await sb
      .from("tickets")
      .update({

        status,

        assigned_to:
          assignee,

        resolution_note:
          note || null

      })
      .eq(
        "id",
        currentTicket.id
      )
      .select();


    if (error) {

      alert(
        "Could not update ticket: " +
        error.message
      );

      return;
    }


    if (
      !data ||
      data.length === 0
    ) {

      alert(
        "Not allowed: you can only update unassigned tickets or tickets assigned to you."
      );

      return;
    }


    await loadTickets();


    alert(
      "Ticket updated."
    );


    // If it is now Resolved or Closed,
    // it will automatically appear in History.
    // Otherwise it stays in active tickets.
    if (
      status === "Resolved" ||
      status === "Closed"
    ) {

      showView("ticketHistory");

    } else {

      showView("tickets");

    }

  }
);


// ---------- STUDENT RESOLUTION ----------

async function respondToResolution(
  fixed
) {

  if (!currentTicket) return;


  const {
    error
  } = await sb.rpc(
    "respond_to_resolution",
    {
      p_ticket_id:
        currentTicket.id,

      p_fixed:
        fixed,

      p_reason:
        $("reopenReason")
          .value
          .trim() || null
    }
  );


  if (error) {

    alert(
      "Could not update ticket: " +
      error.message
    );

    return;
  }


  await loadTickets();


  alert(
    fixed
      ? "Ticket closed. Glad it's fixed!"
      : "Ticket reopened. Staff will take another look."
  );


  if (fixed) {

    showView("ticketHistory");

  } else {

    showView("tickets");

  }

}


$("confirmFixed").addEventListener(
  "click",
  () =>
    respondToResolution(true)
);


$("reopenTicket").addEventListener(
  "click",
  () =>
    respondToResolution(false)
);


// ---------- CONVERSATION ----------

async function loadComments(
  ticketId
) {

  $("commentList").innerHTML =
    '<p class="empty">Loading...</p>';


  const {
    data,
    error
  } = await sb
    .from("ticket_comments")
    .select(`
      *,
      author:profiles!ticket_comments_author_id_fkey(
        full_name,
        role
      )
    `)
    .eq(
      "ticket_id",
      ticketId
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if (error) {

    $("commentList").innerHTML =
      `
        <p class="empty">
          Could not load replies:
          ${escapeHtml(error.message)}
        </p>
      `;

    return;
  }


  $("commentList").innerHTML =
    data.length

      ? data.map(c => {

        const role =
          c.author
            ? c.author.role
            : "student";

        const name =
          c.author
            ? c.author.full_name
            : "Unknown";


        return `

            <div
              class="comment ${role !== "student"
            ? "staff"
            : ""
          }">

              <b>
                ${escapeHtml(name)}
              </b>

              ${role !== "student"
            ? '<span class="tag">Staff</span>'
            : ""
          }

              <small>
                ${new Date(
            c.created_at
          ).toLocaleString()}
              </small>

              <p>
                ${escapeHtml(
            c.message
          )}
              </p>

            </div>

          `;

      }).join("")

      : '<p class="empty">No replies yet.</p>';

}


// ---------- SEND REPLY ----------

$("commentForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();


    if (!currentTicket) return;


    const message =
      $("commentText")
        .value
        .trim();


    if (!message) return;


    const {
      error
    } = await sb
      .from("ticket_comments")
      .insert({

        ticket_id:
          currentTicket.id,

        message

      });


    if (error) {

      alert(
        "Could not send reply: " +
        error.message
      );

      return;
    }


    $("commentText").value = "";


    loadComments(
      currentTicket.id
    );

  }
);


// ---------- DELETE TICKET ----------

$("deleteTicket").addEventListener(
  "click",
  async () => {

    if (!currentTicket) return;


    if (
      !confirm(
        "Delete ticket #" +
        currentTicket.id +
        "? This cannot be undone."
      )
    ) {
      return;
    }


    const {
      data,
      error
    } = await sb
      .from("tickets")
      .delete()
      .eq(
        "id",
        currentTicket.id
      )
      .select();


    if (error) {

      alert(
        "Could not delete ticket: " +
        error.message
      );

      return;
    }


    if (
      !data ||
      data.length === 0
    ) {

      alert(
        "Not allowed: you can only delete your own tickets while they are still Open."
      );

      return;
    }


    currentTicket = null;


    await loadTickets();


    alert(
      "Ticket deleted."
    );


    showView("tickets");

  }
);


// ---------- ADMIN REPORTS ----------

function fmtDuration(ms) {

  if (
    ms == null ||
    isNaN(ms)
  ) {
    return "—";
  }


  const m =
    Math.round(
      ms / 60000
    );


  if (m < 1) {
    return "< 1m";
  }


  const d =
    Math.floor(
      m / 1440
    );


  const h =
    Math.floor(
      (m % 1440) / 60
    );


  const mm =
    m % 60;


  if (d) {
    return `${d}d ${h}h`;
  }


  if (h) {
    return `${h}h ${mm}m`;
  }


  return `${mm}m`;

}


function avgResolution(list) {

  const times =
    list
      .filter(
        t => t.resolved_at
      )
      .map(
        t =>
          new Date(t.resolved_at) -
          new Date(t.created_at)
      );


  return times.length
    ? times.reduce(
      (a, b) => a + b,
      0
    ) / times.length
    : null;

}


function renderReports() {

  const isDone =
    t =>
      t.status === "Resolved" ||
      t.status === "Closed";

  $("repResolved").textContent =
    tickets.filter(
      isDone
    ).length;

  $("repAvg").textContent =
    fmtDuration(
      avgResolution(tickets)
    );

  $("repReopened").textContent =
    tickets.filter(
      t => t.reopen_count > 0
    ).length;

  $("repUnassigned").textContent =
    tickets.filter(
      t => !t.assigned_to
    ).length;

  const group =
    keyFn => {

      const g = {};

      tickets.forEach(t => {

        const k =
          keyFn(t);

        (
          g[k] =
          g[k] || []
        ).push(t);

      });

      return Object.entries(g)
        .sort(
          (a, b) =>
            b[1].length -
            a[1].length
        );

    };

  const max =
    Math.max(
      1,
      tickets.length
    );

  const bar =
    n =>
      `
        <div class="bar">
          <span
            style="
              width:${Math.round(
        n / max * 100
      )}%
            ">
          </span>
        </div>
      `;

  const none =
    cols =>
      `
        <tr>
          <td
            colspan="${cols}"
            class="empty">
            No tickets yet.
          </td>
        </tr>
      `;

  $("repCategory").innerHTML =
    tickets.length

      ? group(
        t => t.category
      )
        .map(
          ([k, l]) => `
            <tr>

              <td>
                ${escapeHtml(k)}
              </td>

              <td>
                ${l.length}
                ${bar(l.length)}
              </td>

              <td>
                ${fmtDuration(
            avgResolution(l)
          )}
              </td>

            </tr>
          `
        ).join("")

      : none(3);

  $("repStaff").innerHTML =
    tickets.length

      ? group(
        t =>
          t.assignee_name ||
          "Unassigned"
      )
        .map(
          ([k, l]) => `
            <tr>

              <td>
                ${escapeHtml(k)}
              </td>

              <td>
                ${l.length}
              </td>

              <td>
                ${l.filter(
            isDone
          ).length
            }
              </td>

              <td>
                ${fmtDuration(
              avgResolution(l)
            )}
              </td>

            </tr>
          `
        ).join("")

      : none(4);

}

// ---------- ADMIN USERS ----------

async function loadUsers() {

  const {
    data,
    error
  } = await sb
    .from("profiles")
    .select(
      "id, full_name, email, role"
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if (error) {

    alert(
      "Could not load users: " +
      error.message
    );

    return;
  }


  $("userTable").innerHTML =
    data.map(u => `

      <tr>

        <td>
          ${escapeHtml(
      u.full_name
    )}
        </td>

        <td>
          ${escapeHtml(
      u.email || "—"
    )}
        </td>

        <td>

          <select
            data-user="${u.id}"
            ${u.id === currentUser.id
        ? "disabled"
        : ""
      }>

            ${[
        "student",
        "staff",
        "admin"
      ]
        .map(
          r => `
                  <option
                    value="${r}"
                    ${u.role === r
              ? "selected"
              : ""
            }>
                    ${r}
                  </option>
                `
        ).join("")
      }

          </select>

        </td>

      </tr>

    `).join("");

}

// ---------- CHANGE ROLE ----------

$("userTable").addEventListener(
  "change",
  async e => {

    const id =
      e.target.dataset.user;

    if (!id) return;

    const {
      data,
      error
    } = await sb
      .from("profiles")
      .update({
        role:
          e.target.value
      })
      .eq(
        "id",
        id
      )
      .select();

    if (
      error ||
      !data ||
      data.length === 0
    ) {

      alert(
        "Could not change role: " +
        (
          error
            ? error.message
            : "not allowed"
        )
      );

      loadUsers();

      return;
    }

    loadStaffList();

  }
);

// ---------- CREATE STAFF / ADMIN ----------

$("staffForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    $("staffError").textContent = "";

    const temp =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

    const {
      data,
      error
    } = await temp.auth.signUp({

      email:
        $("staffEmail")
          .value
          .trim(),

      password:
        $("staffPass").value,

      options: {
        data: {
          full_name:
            $("staffName")
              .value
              .trim()
        }
      }

    });

    if (error) {

      $("staffError").textContent =
        error.message;

      return;
    }

    const {
      data: updated,
      error: roleError
    } = await sb
      .from("profiles")
      .update({

        role:
          $("staffRole").value

      })
      .eq(
        "id",
        data.user.id
      )
      .select();

    if (
      roleError ||
      !updated ||
      updated.length === 0
    ) {

      $("staffError").textContent =
        "Account was created, but its role could not be set. Change it in the list below.";

    } else {

      alert(
        "Account created. They can log in now."
      );

    }

    e.target.reset();

    loadUsers();

    loadStaffList();

  }
);

// ---------- PROFILE ----------

$("saveProfile").addEventListener(
  "click",
  () => {

    const n =
      $("profileName")
        .value
        .trim();

    if (n) {

      $("userName").textContent =
        n;


      alert(
        "Display name updated for this session."
      );

    }

  }
);

// ---------- RESTORE LOGIN ----------

(async function init() {

  const {
    data
  } = await sb.auth.getSession();


  if (
    data.session
  ) {

    await startFromUser(
      data.session.user
    );

  }

})();
