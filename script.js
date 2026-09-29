/* ============================================================
   TASKLY — To-Do App
   Vanilla JavaScript, no frameworks
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     DOM ELEMENTS
     ---------------------------------------------------------- */
  const taskInput          = document.getElementById('taskInput');
  const addTaskBtn         = document.getElementById('addTaskBtn');
  const toggleOptionsBtn   = document.getElementById('toggleOptionsBtn');
  const todoOptions        = document.getElementById('todoOptions');
  const deadlineInput      = document.getElementById('deadlineInput');
  const priorityInput      = document.getElementById('priorityInput');
  const priorityValue      = document.getElementById('priorityValue');
  const recurringInput     = document.getElementById('recurringInput');
  const noteInput          = document.getElementById('noteInput');

  const taskList           = document.getElementById('taskList');
  const modalTaskList      = document.getElementById('modalTaskList');
  const emptyState         = document.getElementById('emptyState');
  const statTotal          = document.getElementById('statTotal');
  const statPending        = document.getElementById('statPending');
  const statCompleted      = document.getElementById('statCompleted');
  const searchInput        = document.getElementById('searchInput');
  const filterButtons      = document.querySelectorAll('.filter');
  const viewAllBtn         = document.getElementById('viewAllBtn');
  const hiddenCount        = document.getElementById('hiddenCount');
  const modal              = document.getElementById('modal');
  const modalBackdrop      = document.getElementById('modalBackdrop');
  const modalClose         = document.getElementById('modalClose');
  const toast              = document.getElementById('toast');
  const themeToggle        = document.getElementById('themeToggle');
  const themeIcon          = document.getElementById('themeIcon');

  /* ----------------------------------------------------------
     STATE
     ---------------------------------------------------------- */
  const STORAGE_KEY = 'taskly-tasks-v5';
  const THEME_KEY   = 'taskly-theme';
  const VISIBLE_LIMIT = 4;          // max tasks shown on main screen

  let tasks = [];                   // array of { id, title, completed, deadline, priority, recurring, note }
  let expandedNotes = new Set();    // set of task IDs with expanded notes
  let currentFilter = 'all';        // 'all' | 'pending' | 'completed'
  let currentSearch = '';
  let editingId = null;             // id of task being edited
  let toastTimer = null;

  /* ----------------------------------------------------------
     UTILITIES & HELPERS
     ---------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDeadline(isoStr) {
    if (!isoStr) return null;
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const isOverdue = diffMs < 0;

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = months[date.getMonth()];
    const dayNum = date.getDate();

    let text = '';

    if (isOverdue) {
      const absMins = Math.abs(diffMins);
      const absHours = Math.abs(diffHours);
      const absDays = Math.abs(diffDays);

      if (absMins < 60) {
        text = `Overdue by ${absMins} min${absMins === 1 ? '' : 's'}`;
      } else if (absHours < 24) {
        text = `Overdue by ${absHours} hour${absHours === 1 ? '' : 's'}`;
      } else {
        text = `Overdue by ${absDays} day${absDays === 1 ? '' : 's'}`;
      }
    } else {
      const isToday = date.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = date.toDateString() === tomorrow.toDateString();

      if (diffMins <= 0) {
        text = `Due right now`;
      } else if (diffMins < 60) {
        text = `Due in ${diffMins} min${diffMins === 1 ? '' : 's'}`;
      } else if (isToday) {
        text = `Due today at ${timeStr} (${diffHours}h left)`;
      } else if (isTomorrow) {
        text = `Due tomorrow at ${timeStr}`;
      } else if (diffDays > 1 && diffDays <= 7) {
        text = `Due in ${diffDays} days (${monthStr} ${dayNum})`;
      } else {
        text = `${monthStr} ${dayNum}, ${timeStr}`;
      }
    }

    return { text, isOverdue };
  }

  function getNextDeadline(currentIso, recurringType) {
    let baseDate = currentIso ? new Date(currentIso) : new Date();
    if (isNaN(baseDate.getTime())) baseDate = new Date();

    const nextDate = new Date(baseDate);

    if (recurringType === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (recurringType === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (recurringType === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
      return '';
    }

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getDate()).padStart(2, '0');
    const hours = String(nextDate.getHours()).padStart(2, '0');
    const minutes = String(nextDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /* ----------------------------------------------------------
     TOAST NOTIFICATION
     ---------------------------------------------------------- */
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  /* ----------------------------------------------------------
     LOCAL STORAGE
     ---------------------------------------------------------- */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      /* ignore storage errors */
    }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('taskly-tasks-v4');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tasks = parsed.map(t => ({
            id: t.id || uid(),
            title: typeof t.title === 'string' ? t.title : '',
            completed: Boolean(t.completed),
            deadline: t.deadline || '',
            priority: typeof t.priority === 'number' ? t.priority : 0,
            recurring: t.recurring || 'none',
            note: t.note || ''
          })).filter(t => t.title.trim().length > 0);
          return;
        }
      }
    } catch (e) {
      /* ignore */
    }
    tasks = [];
    saveTasks();
  }

  /* ----------------------------------------------------------
     STATS
     ---------------------------------------------------------- */
  function updateStats() {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending   = total - completed;

    statTotal.textContent     = total;
    statPending.textContent   = pending;
    statCompleted.textContent = completed;
  }

  /* ----------------------------------------------------------
     FILTERING
     ---------------------------------------------------------- */
  function getFilteredTasks() {
    return tasks.filter(task => {
      // Filter by status
      if (currentFilter === 'pending'   && task.completed)  return false;
      if (currentFilter === 'completed' && !task.completed) return false;

      // Filter by search (checks title and note)
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(q);
        const inNote  = task.note && task.note.toLowerCase().includes(q);
        if (!inTitle && !inNote) return false;
      }
      return true;
    });
  }

  /* ----------------------------------------------------------
     RENDER TASK ITEM (shared between main list and modal)
     ---------------------------------------------------------- */
  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.dataset.id = task.id;

    // Main row
    const main = document.createElement('div');
    main.className = 'task-item__main';

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task__checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', 'Toggle task completion');
    checkbox.addEventListener('change', () => toggleTask(task.id));

    // Title & Meta container
    const content = document.createElement('div');
    content.className = 'task__content';

    const title = document.createElement('span');
    title.className = 'task__title';
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'task__meta';

    // Priority badge
    const priorityVal = typeof task.priority === 'number' ? task.priority : 0;
    const pBadge = document.createElement('span');
    pBadge.className = 'task-badge task-badge--priority';
    if (priorityVal >= 67) pBadge.classList.add('p-high');
    else if (priorityVal >= 34) pBadge.classList.add('p-med');
    else pBadge.classList.add('p-low');
    pBadge.textContent = `🎯 ${priorityVal}%`;
    meta.appendChild(pBadge);

    // Deadline badge
    if (task.deadline) {
      const formatted = formatDeadline(task.deadline);
      if (formatted) {
        const dBadge = document.createElement('span');
        dBadge.className = 'task-badge task-badge--deadline';
        if (formatted.isOverdue && !task.completed) {
          dBadge.classList.add('overdue');
          dBadge.textContent = `⚠️ ${formatted.text}`;
        } else {
          dBadge.textContent = `📅 ${formatted.text}`;
        }
        meta.appendChild(dBadge);
      }
    }

    // Recurring badge
    if (task.recurring && task.recurring !== 'none') {
      const rBadge = document.createElement('span');
      rBadge.className = 'task-badge task-badge--recurring';
      const capitalized = task.recurring.charAt(0).toUpperCase() + task.recurring.slice(1);
      rBadge.textContent = `🔁 ${capitalized}`;
      meta.appendChild(rBadge);
    }

    content.appendChild(title);
    content.appendChild(meta);

    // Actions container
    const actions = document.createElement('div');
    actions.className = 'task__actions';

    // Note drawer reference
    let noteDrawer = null;
    if (task.note && task.note.trim()) {
      const noteBtn = document.createElement('button');
      noteBtn.className = 'task__btn task__btn--note' + (expandedNotes.has(task.id) ? ' active' : '');
      noteBtn.setAttribute('aria-label', 'Toggle note');
      noteBtn.setAttribute('title', 'View note');
      noteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';

      noteDrawer = document.createElement('div');
      noteDrawer.className = 'task-item__note' + (expandedNotes.has(task.id) ? '' : ' hidden');
      noteDrawer.innerHTML = `<span class="task-item__note-icon">📝</span><span class="task-item__note-text"></span>`;
      noteDrawer.querySelector('.task-item__note-text').textContent = task.note;

      noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedNotes.has(task.id)) {
          expandedNotes.delete(task.id);
          noteDrawer.classList.add('hidden');
          noteBtn.classList.remove('active');
        } else {
          expandedNotes.add(task.id);
          noteDrawer.classList.remove('hidden');
          noteBtn.classList.add('active');
        }
      });

      actions.appendChild(noteBtn);
    }

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'task__btn';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.setAttribute('title', 'Edit task');
    editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    editBtn.addEventListener('click', () => startEditTask(task.id));

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task__btn task__btn--delete';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.setAttribute('title', 'Delete task');
    deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    main.appendChild(checkbox);
    main.appendChild(content);
    main.appendChild(actions);

    li.appendChild(main);
    if (noteDrawer) {
      li.appendChild(noteDrawer);
    }

    return li;
  }

  /* ----------------------------------------------------------
     RENDER MAIN LIST
     ---------------------------------------------------------- */
  function render() {
    const filtered = getFilteredTasks();

    // Clear lists
    taskList.innerHTML = '';
    modalTaskList.innerHTML = '';

    // Empty state
    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      taskList.style.display = 'none';
      viewAllBtn.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      taskList.style.display = 'flex';

      // Show only the most recent VISIBLE_LIMIT tasks on main screen
      const visibleTasks = filtered.slice(0, VISIBLE_LIMIT);
      const remaining = filtered.length - visibleTasks.length;

      visibleTasks.forEach(task => {
        taskList.appendChild(createTaskElement(task));
      });

      // View-all button
      if (remaining > 0) {
        viewAllBtn.classList.remove('hidden');
        hiddenCount.textContent = remaining;
      } else {
        viewAllBtn.classList.add('hidden');
      }
    }

    // Populate modal list (all filtered tasks)
    filtered.forEach(task => {
      modalTaskList.appendChild(createTaskElement(task));
    });

    updateStats();
  }

  /* ----------------------------------------------------------
     ADD TASK
     ---------------------------------------------------------- */
  function addTask() {
    const title = taskInput.value.trim();

    if (!title) {
      taskInput.focus();
      taskInput.style.borderColor = 'var(--red)';
      taskInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
      setTimeout(() => {
        taskInput.style.borderColor = '';
        taskInput.style.boxShadow = '';
      }, 1200);
      showToast('Please enter a task title');
      return;
    }

    tasks.unshift({
      id: uid(),
      title: title,
      completed: false,
      deadline: deadlineInput.value || '',
      priority: parseInt(priorityInput.value, 10) || 0,
      recurring: recurringInput.value || 'none',
      note: noteInput.value.trim() || ''
    });

    saveTasks();
    render();

    // Reset inputs
    resetOptionForm();
    taskInput.focus();
    showToast('Task added');
  }

  /* ----------------------------------------------------------
     TOGGLE COMPLETION
     ---------------------------------------------------------- */
  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    render();
    showToast(task.completed ? 'Task completed' : 'Task reopened');
  }

  /* ----------------------------------------------------------
     DELETE TASK
     ---------------------------------------------------------- */
  function deleteTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    tasks.splice(index, 1);
    expandedNotes.delete(id);
    saveTasks();
    render();
    showToast('Task deleted');
  }

  /* ----------------------------------------------------------
     EDIT TASK
     ---------------------------------------------------------- */
  function startEditTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    taskInput.value = task.title;
    deadlineInput.value = task.deadline || '';
    priorityInput.value = typeof task.priority === 'number' ? task.priority : 0;
    priorityValue.textContent = `${priorityInput.value}%`;
    recurringInput.value = task.recurring || 'none';
    noteInput.value = task.note || '';

    // Open options panel
    todoOptions.classList.remove('hidden');
    toggleOptionsBtn.classList.add('active');

    taskInput.focus();
    taskInput.select();
    editingId = id;

    // Change Add button into Save button
    addTaskBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    addTaskBtn.style.background = 'var(--green)';

    showToast('Editing task — update fields & click ✓ to save');
  }

  function saveEdit() {
    const newTitle = taskInput.value.trim();
    if (!newTitle) {
      showToast('Task title cannot be empty');
      return;
    }

    const task = tasks.find(t => t.id === editingId);
    if (task) {
      task.title = newTitle;
      task.deadline = deadlineInput.value || '';
      task.priority = parseInt(priorityInput.value, 10) || 0;
      task.recurring = recurringInput.value || 'none';
      task.note = noteInput.value.trim() || '';

      saveTasks();
      render();
      showToast('Task updated');
    }

    cancelEdit();
  }

  function cancelEdit() {
    editingId = null;
    resetOptionForm();
    addTaskBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    addTaskBtn.style.background = '';
    taskInput.style.borderColor = '';
    taskInput.style.boxShadow = '';
  }

  function resetOptionForm() {
    taskInput.value = '';
    deadlineInput.value = '';
    priorityInput.value = '0';
    priorityValue.textContent = '0%';
    recurringInput.value = 'none';
    noteInput.value = '';
    todoOptions.classList.add('hidden');
    toggleOptionsBtn.classList.remove('active');
  }

  /* ----------------------------------------------------------
     EVENT LISTENERS
     ---------------------------------------------------------- */

  // Options toggle
  toggleOptionsBtn.addEventListener('click', () => {
    todoOptions.classList.toggle('hidden');
    toggleOptionsBtn.classList.toggle('active');
  });

  // Priority range slider readout
  priorityInput.addEventListener('input', (e) => {
    priorityValue.textContent = `${e.target.value}%`;
  });

  // Add / Save task
  addTaskBtn.addEventListener('click', () => {
    if (editingId) saveEdit();
    else addTask();
  });

  // Enter key in input
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingId) saveEdit();
      else addTask();
    }
    if (e.key === 'Escape' && editingId) cancelEdit();
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    render();
  });

  // Filters
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('filter--active'));
      btn.classList.add('filter--active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // View all (open modal)
  viewAllBtn.addEventListener('click', () => {
    modal.classList.add('open');
  });

  // Modal close
  modalClose.addEventListener('click', () => modal.classList.remove('open'));
  modalBackdrop.addEventListener('click', () => modal.classList.remove('open'));

  // Escape closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      modal.classList.remove('open');
    }
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (e) { /* ignore */ }
  });

  // Load theme
  (function initTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark') {
        document.body.classList.add('dark');
        themeIcon.textContent = '☀️';
      }
    } catch (e) { /* ignore */ }
  })();

  /* ----------------------------------------------------------
     FOCUS TIMER SIDE CARD LOGIC
     ---------------------------------------------------------- */
  const timerWidget        = document.getElementById('timerWidget');
  const customMinutesInput = document.getElementById('customMinutesInput');
  const setCustomTimeBtn   = document.getElementById('setCustomTimeBtn');
  const presetButtons      = document.querySelectorAll('.preset-btn');

  const timerDisplay       = document.getElementById('timerDisplay');
  const timerStartBtn      = document.getElementById('timerStartBtn');
  const timerStartText     = document.getElementById('timerStartText');
  const timerPlayIcon      = document.getElementById('timerPlayIcon');
  const timerResetBtn      = document.getElementById('timerResetBtn');
  const timerProgressFill  = document.getElementById('timerProgressFill');

  let timerInterval = null;
  let timerTotalSeconds = 1500;
  let timerRemainingSeconds = 1500;
  let timerIsRunning = false;

  function formatTimerTime(sec) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function updateTimerUI() {
    if (timerDisplay) timerDisplay.textContent = formatTimerTime(timerRemainingSeconds);
    const pct = timerTotalSeconds > 0 ? (timerRemainingSeconds / timerTotalSeconds) * 100 : 0;
    if (timerProgressFill) timerProgressFill.style.width = `${pct}%`;

    if (timerIsRunning) {
      document.title = `(${formatTimerTime(timerRemainingSeconds)}) Taskly`;
    } else {
      document.title = 'Taskly — Stay Organized';
    }
  }

  function playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) { /* audio fallback */ }
  }

  function setCustomTimerSeconds(seconds) {
    pauseTimer();
    timerTotalSeconds = seconds;
    timerRemainingSeconds = seconds;

    presetButtons.forEach(btn => {
      const s = parseInt(btn.dataset.time, 10);
      btn.classList.toggle('active', s === seconds);
    });

    updateTimerUI();
  }

  function startTimer() {
    if (timerIsRunning) return;
    timerIsRunning = true;
    if (timerStartText) timerStartText.textContent = 'Pause';
    if (timerPlayIcon) timerPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    if (timerStartBtn) timerStartBtn.classList.add('active');

    timerInterval = setInterval(() => {
      if (timerRemainingSeconds > 0) {
        timerRemainingSeconds--;
        updateTimerUI();
      } else {
        pauseTimer();
        playChime();
        showToast('🎉 Timer completed!');
      }
    }, 1000);
  }

  function pauseTimer() {
    timerIsRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    if (timerStartText) timerStartText.textContent = 'Start';
    if (timerPlayIcon) timerPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    if (timerStartBtn) timerStartBtn.classList.remove('active');
    updateTimerUI();
  }

  function resetTimer() {
    pauseTimer();
    timerRemainingSeconds = timerTotalSeconds;
    updateTimerUI();
  }

  function applyCustomInputMinutes() {
    if (!customMinutesInput) return;
    const mins = parseInt(customMinutesInput.value, 10);
    if (isNaN(mins) || mins <= 0) {
      showToast('Please enter valid minutes (1-300)');
      return;
    }
    setCustomTimerSeconds(mins * 60);
    showToast(`Timer set to ${mins} min${mins === 1 ? '' : 's'}`);
  }

  if (setCustomTimeBtn) {
    setCustomTimeBtn.addEventListener('click', applyCustomInputMinutes);
  }
  if (customMinutesInput) {
    customMinutesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomInputMinutes();
      }
    });
  }

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const seconds = parseInt(btn.dataset.time, 10) || 1500;
      if (customMinutesInput) customMinutesInput.value = Math.floor(seconds / 60);
      setCustomTimerSeconds(seconds);
    });
  });

  if (timerStartBtn) {
    timerStartBtn.addEventListener('click', () => {
      if (timerIsRunning) pauseTimer();
      else startTimer();
    });
  }

  if (timerResetBtn) {
    timerResetBtn.addEventListener('click', resetTimer);
  }

  /* ----------------------------------------------------------
     INIT
     ---------------------------------------------------------- */
  loadTasks();
  render();
  updateTimerUI();

})();