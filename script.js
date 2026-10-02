/* ============================================================
   TASKLY 🌸 — Dashboard Script (Clean & Modular)
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     CONSTANTS & STATE
     ---------------------------------------------------------- */
  const STORAGE_KEY = 'taskly-v9-clean-tasks';
  const THEME_KEY   = 'taskly-v8-theme';

  // No pre-written tasks
  const DEFAULT_TASKS = [];

  let tasks = [];
  let expandedNotes = new Set();
  let editingId = null;
  let currentCategory = 'all';
  let currentFilter = 'all';
  let calendarDate = new Date(2026, 9, 1); // October 2026
  let toastTimer = null;

  /* ----------------------------------------------------------
     DOM ELEMENTS
     ---------------------------------------------------------- */
  const sidebarNavBtns     = document.querySelectorAll('.sidebar-menu .nav-btn');
  const activeCategoryTitle= document.getElementById('activeCategoryTitle');
  const greetingText       = document.getElementById('greetingText');
  const themeToggleBtn     = document.getElementById('themeToggleBtn');
  const themeIcon          = document.getElementById('themeIcon');
  const themeText          = document.getElementById('themeText');

  const statTotal          = document.getElementById('statTotal');
  const statPending        = document.getElementById('statPending');
  const statDone           = document.getElementById('statDone');
  const progressText       = document.getElementById('progressText');
  const progressFill       = document.getElementById('progressFill');

  const taskInput          = document.getElementById('taskInput');
  const toggleOptionsBtn   = document.getElementById('toggleOptionsBtn');
  const optionsDrawer      = document.getElementById('optionsDrawer');
  const prioritySelect     = document.getElementById('prioritySelect');
  const deadlineInput      = document.getElementById('deadlineInput');
  const recurringSelect    = document.getElementById('recurringSelect');
  const noteInput          = document.getElementById('noteInput');
  const addTaskBtn         = document.getElementById('addTaskBtn');

  const tabBtns            = document.querySelectorAll('.tab-btn');
  const taskList           = document.getElementById('taskList');
  const emptyState         = document.getElementById('emptyState');

  const clockTime          = document.getElementById('clockTime');
  const calTitle           = document.getElementById('calTitle');
  const calDays            = document.getElementById('calDays');
  const calPrevBtn         = document.getElementById('calPrevBtn');
  const calNextBtn         = document.getElementById('calNextBtn');

  const timerPresets       = document.querySelectorAll('.preset-btn');
  const timerDisplay       = document.getElementById('timerDisplay');
  const timerStartBtn      = document.getElementById('timerStartBtn');
  const timerResetBtn      = document.getElementById('timerResetBtn');

  const toast              = document.getElementById('toast');

  /* ----------------------------------------------------------
     STORAGE & INITIALIZATION
     ---------------------------------------------------------- */
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        tasks = JSON.parse(raw);
        if (Array.isArray(tasks)) return;
      }
    } catch (e) { /* fallback */ }
    tasks = [];
    saveTasks();
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) { /* fallback */ }
  }

  /* ----------------------------------------------------------
     DATE & TIME HELPERS
     ---------------------------------------------------------- */
  function formatDeadlineText(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const formattedDate = `${month} ${day}, ${hours}:${minutes} ${ampm}`;

    // Calculate time left
    const now = new Date();
    const diffMs = date - now;
    if (diffMs > 0) {
      const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
      const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hoursLeft > 24) {
        const daysLeft = Math.floor(hoursLeft / 24);
        return `${formattedDate} · ${daysLeft}d left`;
      }
      return `${formattedDate} · ${hoursLeft}h ${minsLeft}m left`;
    }

    return formattedDate;
  }

  function isDueToday(isoStr) {
    if (!isoStr) return false;
    const date = new Date(isoStr);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }

  function isOverdue(isoStr) {
    if (!isoStr) return false;
    const date = new Date(isoStr);
    return date < new Date() && !isDueToday(isoStr);
  }

  /* ----------------------------------------------------------
     TOAST
     ---------------------------------------------------------- */
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  /* ----------------------------------------------------------
     RENDER ENGINE
     ---------------------------------------------------------- */
  function renderAll() {
    renderSidebarCounters();
    renderTasks();
    renderStats();
  }

  function renderSidebarCounters() {
    const counts = {
      all: tasks.length,
      today: tasks.filter(t => isDueToday(t.deadline) && !t.completed).length,
      overdue: tasks.filter(t => isOverdue(t.deadline) && !t.completed).length,
      high: tasks.filter(t => t.priority === 'high' && !t.completed).length,
      recurring: tasks.filter(t => t.recurring && t.recurring !== 'none' && !t.completed).length
    };

    document.getElementById('badgeAll').textContent = counts.all;
    document.getElementById('badgeToday').textContent = counts.today;
    document.getElementById('badgeOverdue').textContent = counts.overdue;
    document.getElementById('badgeHigh').textContent = counts.high;
    document.getElementById('badgeRecurring').textContent = counts.recurring;
  }

  function renderStats() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const pending = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    statTotal.textContent = total;
    statPending.textContent = pending;
    statDone.textContent = done;

    progressText.textContent = `${percent}% completed ✨`;
    progressFill.style.width = `${percent}%`;
  }

  function renderTasks() {
    taskList.innerHTML = '';

    // Filter by Category
    let filtered = tasks.filter(task => {
      if (currentCategory === 'today') return isDueToday(task.deadline);
      if (currentCategory === 'overdue') return isOverdue(task.deadline);
      if (currentCategory === 'high') return task.priority === 'high';
      if (currentCategory === 'recurring') return task.recurring && task.recurring !== 'none';
      return true; // 'all'
    });

    // Filter by Tab (all / pending / done)
    filtered = filtered.filter(task => {
      if (currentFilter === 'pending') return !task.completed;
      if (currentFilter === 'done') return task.completed;
      return true;
    });

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach(task => {
        taskList.appendChild(createTaskElement(task));
      });
    }
  }

  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.dataset.id = task.id;

    // Checkbox Button
    const checkBtn = document.createElement('button');
    checkBtn.className = 'check-btn';
    checkBtn.innerHTML = `<svg class="check-icon" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    checkBtn.addEventListener('click', () => toggleTask(task.id));

    // Content container
    const content = document.createElement('div');
    content.className = 'task-content';

    // Title line + Action buttons
    const titleLine = document.createElement('div');
    titleLine.className = 'task-title-line';

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    // Action buttons container: Notes, Edit, Delete
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'task-actions';

    const isNoteOpen = expandedNotes.has(task.id);
    const notesBtn = document.createElement('button');
    notesBtn.className = 'action-btn' + (isNoteOpen ? ' active' : '');
    notesBtn.textContent = 'Notes';
    notesBtn.title = isNoteOpen ? 'Close notes' : 'View notes';
    notesBtn.addEventListener('click', () => {
      if (expandedNotes.has(task.id)) expandedNotes.delete(task.id);
      else expandedNotes.add(task.id);
      renderAll();
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.textContent = 'Edit';
    editBtn.title = 'Edit task';
    editBtn.addEventListener('click', () => startEditTask(task.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn btn-action-delete';
    delBtn.textContent = 'Delete';
    delBtn.title = 'Delete task';
    delBtn.addEventListener('click', () => deleteTask(task.id));

    actionsWrap.appendChild(notesBtn);
    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(delBtn);

    titleLine.appendChild(title);
    titleLine.appendChild(actionsWrap);
    content.appendChild(titleLine);

    // Meta Badges Row
    const metaRow = document.createElement('div');
    metaRow.className = 'task-meta-row';

    // Priority Tag
    if (task.priority && task.priority !== 'none') {
      const pTag = document.createElement('span');
      const pClass = task.priority === 'high' ? 'priority-high' : task.priority === 'medium' ? 'priority-med' : 'priority-low';
      const pPct = task.priorityPercent || (task.priority === 'high' ? '80%' : task.priority === 'medium' ? '60%' : '30%');
      pTag.className = `meta-tag ${pClass}`;
      pTag.textContent = `⚡ ${pPct}`;
      metaRow.appendChild(pTag);
    }

    // Deadline Tag
    if (task.deadline) {
      const dTag = document.createElement('span');
      dTag.className = 'meta-tag due-tag';
      dTag.textContent = `📅 ${formatDeadlineText(task.deadline)}`;
      metaRow.appendChild(dTag);
    }

    // Recurring Tag
    if (task.recurring && task.recurring !== 'none') {
      const rTag = document.createElement('span');
      rTag.className = 'meta-tag repeat-tag';
      rTag.textContent = `🔄 ${task.recurring}`;
      metaRow.appendChild(rTag);
    }

    if (metaRow.children.length > 0) {
      content.appendChild(metaRow);
    }

    // Expanded Note Box or Inline Note Line
    if (isNoteOpen || (task.note && task.note.trim() && !isNoteOpen)) {
      const noteLine = document.createElement('div');
      noteLine.className = 'task-note-line' + (isNoteOpen ? ' expanded-note-box' : '');
      const noteText = task.note && task.note.trim() ? task.note.trim() : 'No notes added yet.';
      noteLine.textContent = `📝 ${noteText}`;
      content.appendChild(noteLine);
    }

    li.appendChild(checkBtn);
    li.appendChild(content);

    return li;
  }

  /* ----------------------------------------------------------
     TASK ACTIONS (ADD / EDIT / DELETE / TOGGLE)
     ---------------------------------------------------------- */
  function addTask() {
    const title = taskInput.value.trim();
    if (!title) {
      taskInput.focus();
      showToast('Please enter a task title');
      return;
    }

    const priorityVal = prioritySelect.value;
    const priorityPct = priorityVal === 'high' ? '80%' : priorityVal === 'medium' ? '60%' : priorityVal === 'low' ? '30%' : '0%';

    if (editingId) {
      const task = tasks.find(t => t.id === editingId);
      if (task) {
        task.title = title;
        task.priority = priorityVal;
        task.priorityPercent = priorityPct;
        task.deadline = deadlineInput.value || '';
        task.recurring = recurringSelect.value || 'none';
        task.note = noteInput.value.trim() || '';
        showToast('Task updated! ✨');
      }
      editingId = null;
      addTaskBtn.textContent = '+';
    } else {
      tasks.unshift({
        id: 'task-' + Date.now(),
        title: title,
        completed: false,
        priority: priorityVal,
        priorityPercent: priorityPct,
        deadline: deadlineInput.value || '',
        recurring: recurringSelect.value || 'none',
        note: noteInput.value.trim() || '',
        createdAt: Date.now()
      });
      showToast('Task added! 🌸');
    }

    saveTasks();
    renderAll();
    resetTaskForm();
  }

  function startEditTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editingId = id;
    taskInput.value = task.title;
    prioritySelect.value = task.priority || 'none';
    deadlineInput.value = task.deadline || '';
    recurringSelect.value = task.recurring || 'none';
    noteInput.value = task.note || '';

    optionsDrawer.classList.remove('hidden');
    toggleOptionsBtn.classList.add('active');
    addTaskBtn.textContent = 'Save';
    taskInput.focus();

    showToast('Editing task — make changes and click Save');
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    renderAll();
    showToast(task.completed ? 'Task completed! ✨' : 'Task reopened');
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderAll();
    showToast('Task deleted');
  }

  function resetTaskForm() {
    taskInput.value = '';
    deadlineInput.value = '';
    prioritySelect.value = 'high';
    recurringSelect.value = 'none';
    noteInput.value = '';
    optionsDrawer.classList.add('hidden');
    toggleOptionsBtn.classList.remove('active');
  }

  /* ----------------------------------------------------------
     CLOCK & GREETING
     ---------------------------------------------------------- */
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockTime.textContent = `${hours}:${mins}`;

    const h = now.getHours();
    let greet = 'Good evening 🌸';
    if (h >= 5 && h < 12) greet = 'Good morning 🌸';
    else if (h >= 12 && h < 17) greet = 'Good afternoon 🌸';
    greetingText.textContent = greet;
  }

  /* ----------------------------------------------------------
     CALENDAR
     ---------------------------------------------------------- */
  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    calTitle.textContent = `${monthNames[month]} ${year}`;
    calDays.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Empty lead cells
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      calDays.appendChild(empty);
    }

    const today = new Date();
    for (let d = 1; d <= totalDays; d++) {
      const dayCell = document.createElement('div');
      dayCell.className = 'cal-day';
      dayCell.textContent = d;

      if (year === today.getFullYear() && month === today.getMonth() && d === today.getDate()) {
        dayCell.classList.add('today');
      }

      dayCell.addEventListener('click', () => {
        document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
        dayCell.classList.add('selected');
      });

      calDays.appendChild(dayCell);
    }
  }

  /* ----------------------------------------------------------
     FOCUS TIMER
     ---------------------------------------------------------- */
  let timerInterval = null;
  let timerTotalSec = 1500;
  let timerRemainingSec = 1500;
  let timerRunning = false;

  function formatTimerTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = formatTimerTime(timerRemainingSec);
  }

  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerStartBtn.textContent = 'Pause';

    timerInterval = setInterval(() => {
      if (timerRemainingSec > 0) {
        timerRemainingSec--;
        updateTimerDisplay();
      } else {
        pauseTimer();
        showToast('🎉 Focus session finished!');
      }
    }, 1000);
  }

  function pauseTimer() {
    timerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerStartBtn.textContent = 'Start';
  }

  function resetTimer() {
    pauseTimer();
    timerRemainingSec = timerTotalSec;
    updateTimerDisplay();
  }

  /* ----------------------------------------------------------
     THEME TOGGLE
     ---------------------------------------------------------- */
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    setTheme(saved);
  }

  function setTheme(theme) {
    if (theme === 'light') {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Light';
    } else {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Dark';
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  /* ----------------------------------------------------------
     EVENT LISTENERS
     ---------------------------------------------------------- */
  // Category Navigation
  sidebarNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebarNavBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;

      const titleMap = {
        all: 'All tasks',
        today: 'Due today',
        overdue: 'Overdue',
        high: 'High priority',
        recurring: 'Recurring'
      };
      activeCategoryTitle.textContent = titleMap[currentCategory] || 'Tasks';
      renderTasks();
    });
  });

  // Filter Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // Toggle Options Drawer
  toggleOptionsBtn.addEventListener('click', () => {
    optionsDrawer.classList.toggle('hidden');
    toggleOptionsBtn.classList.toggle('active');
  });

  // Add Task
  addTaskBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Theme Toggle Button
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  });

  // Calendar Controls
  calPrevBtn.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  calNextBtn.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });

  // Focus Timer Controls
  timerPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      timerPresets.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timerTotalSec = parseInt(btn.dataset.sec, 10) || 1500;
      resetTimer();
    });
  });

  timerStartBtn.addEventListener('click', () => {
    if (timerRunning) pauseTimer();
    else startTimer();
  });

  timerResetBtn.addEventListener('click', resetTimer);

  /* ----------------------------------------------------------
     STARTUP
     ---------------------------------------------------------- */
  initTheme();
  loadTasks();
  renderAll();
  updateClock();
  setInterval(updateClock, 1000);
  renderCalendar();
  updateTimerDisplay();

})();