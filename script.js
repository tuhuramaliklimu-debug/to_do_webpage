/* ============================================================
   TASKLY — Dashboard Script
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
  const recurringInput     = document.getElementById('recurringInput');
  const noteInput          = document.getElementById('noteInput');

  const pendingTaskList      = document.getElementById('pendingTaskList');
  const completedTaskList    = document.getElementById('completedTaskList');
  const pendingSection       = document.getElementById('pendingSection');
  const completedSection     = document.getElementById('completedSection');
  const pendingSectionCount  = document.getElementById('pendingSectionCount');
  const completedSectionCount= document.getElementById('completedSectionCount');

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
     STATE & DEMO DATA
     ---------------------------------------------------------- */
  const STORAGE_KEY  = 'taskly-tasks-v7';
  const THEME_KEY    = 'taskly-theme';
  const VISIBLE_LIMIT = 10;

  const DEFAULT_TASKS = [];

  let tasks = [];
  let expandedNotes = new Set();
  let currentFilter = 'all';
  let currentSearch = '';
  let editingId = null;
  let toastTimer = null;

  /* ----------------------------------------------------------
     UTILITIES
     ---------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatShortDate(isoStr) {
    if (!isoStr) return '—';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '—';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  function formatRepeatText(type) {
    if (!type || type === 'none') return '—';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function getPriorityWeight(priority) {
    if (priority === 'high' || priority === 3 || priority >= 70) return 3;
    if (priority === 'medium' || priority === 2 || priority >= 40) return 2;
    if (priority === 'low' || priority === 1 || priority > 0) return 1;
    return 0;
  }

  function formatPriorityBadge(priority) {
    const w = getPriorityWeight(priority);
    if (w === 3) return { label: 'High', class: 'priority-badge--high' };
    if (w === 2) return { label: 'Medium', class: 'priority-badge--med' };
    if (w === 1) return { label: 'Low', class: 'priority-badge--low' };
    return { label: 'None', class: 'priority-badge--none' };
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
    }, 2000);
  }

  /* ----------------------------------------------------------
     LOCAL STORAGE
     ---------------------------------------------------------- */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) { /* ignore */ }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tasks = parsed;
          return;
        }
      }
    } catch (e) { /* ignore */ }

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

    if (statTotal)     statTotal.textContent     = total;
    if (statPending)   statPending.textContent   = pending;
    if (statCompleted) statCompleted.textContent = completed;
  }

  /* ----------------------------------------------------------
     FILTERING & SORTING
     ---------------------------------------------------------- */
  function getFilteredTasks() {
    const filtered = tasks.filter(task => {
      if (currentFilter === 'pending'   && task.completed)  return false;
      if (currentFilter === 'completed' && !task.completed) return false;

      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(q);
        const inNote  = task.note && task.note.toLowerCase().includes(q);
        if (!inTitle && !inNote) return false;
      }
      return true;
    });

    // Sort according to priority (highest priority first)
    filtered.sort((a, b) => getPriorityWeight(b.priority) - getPriorityWeight(a.priority));

    return filtered;
  }

  /* ----------------------------------------------------------
     RENDER TASK ROW ELEMENT
     ---------------------------------------------------------- */
  function createTaskRowElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.dataset.id = task.id;

    // 1. Task Checkbox + Title Cell
    const cellTask = document.createElement('div');
    cellTask.className = 'task__cell-task';

    const checkBtn = document.createElement('button');
    checkBtn.className = 'task__check-btn';
    checkBtn.setAttribute('aria-label', 'Toggle task completion');
    checkBtn.innerHTML = '<svg class="task__check-icon" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    checkBtn.addEventListener('click', () => toggleTask(task.id));

    const titleText = document.createElement('span');
    titleText.className = 'task__title-text';
    titleText.textContent = task.title;

    cellTask.appendChild(checkBtn);
    cellTask.appendChild(titleText);

    // 2. Priority Cell
    const cellPriority = document.createElement('div');
    cellPriority.className = 'task__cell-priority';

    const pData = formatPriorityBadge(task.priority);
    const badge = document.createElement('span');
    badge.className = `priority-badge ${pData.class}`;
    badge.textContent = pData.label;
    cellPriority.appendChild(badge);

    // 3. Due Cell
    const cellDue = document.createElement('div');
    cellDue.className = 'task__cell-due';
    cellDue.textContent = formatShortDate(task.deadline);

    // 4. Repeat Cell
    const cellRepeat = document.createElement('div');
    cellRepeat.className = 'task__cell-repeat';
    cellRepeat.textContent = formatRepeatText(task.recurring);

    // 5. Actions Cell (Notes, Edit & Delete buttons)
    const cellActions = document.createElement('div');
    cellActions.className = 'task__cell-actions';

    const isNoteOpen = expandedNotes.has(task.id);

    const noteBtn = document.createElement('button');
    noteBtn.className = 'action-btn action-btn--note' + (isNoteOpen ? ' active' : '');
    noteBtn.textContent = 'Notes';
    noteBtn.setAttribute('title', isNoteOpen ? 'Close notes' : 'Open notes');
    noteBtn.addEventListener('click', () => {
      if (expandedNotes.has(task.id)) {
        expandedNotes.delete(task.id);
      } else {
        expandedNotes.add(task.id);
      }
      render();
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn action-btn--edit';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => startEditTask(task.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn action-btn--delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    cellActions.appendChild(noteBtn);
    cellActions.appendChild(editBtn);
    cellActions.appendChild(deleteBtn);

    // Append cells to row
    li.appendChild(cellTask);
    li.appendChild(cellPriority);
    li.appendChild(cellDue);
    li.appendChild(cellRepeat);
    li.appendChild(cellActions);

    // If note row is toggled open for this task
    if (isNoteOpen) {
      const noteRow = document.createElement('div');
      noteRow.className = 'task-item__note-row';
      const text = (task.note && task.note.trim()) ? task.note : 'No notes added yet.';
      noteRow.innerHTML = `📝 <span>${text}</span>`;
      li.appendChild(noteRow);
    }

    return li;
  }

  /* ----------------------------------------------------------
     RENDER MAIN SCREEN
     ---------------------------------------------------------- */
  function render() {
    const filtered = getFilteredTasks();

    pendingTaskList.innerHTML = '';
    completedTaskList.innerHTML = '';
    if (modalTaskList) modalTaskList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      pendingSection.style.display = 'none';
      completedSection.style.display = 'none';
      viewAllBtn.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');

      const pendingTasks   = filtered.filter(t => !t.completed);
      const completedTasks = filtered.filter(t => t.completed);

      // Pending section
      if (pendingTasks.length > 0) {
        pendingSection.style.display = 'block';
        pendingSectionCount.textContent = pendingTasks.length;
        pendingTasks.forEach(task => {
          pendingTaskList.appendChild(createTaskRowElement(task));
        });
      } else {
        pendingSection.style.display = 'none';
      }

      // Completed section
      if (completedTasks.length > 0) {
        completedSection.style.display = 'block';
        completedSectionCount.textContent = completedTasks.length;
        completedTasks.forEach(task => {
          completedTaskList.appendChild(createTaskRowElement(task));
        });
      } else {
        completedSection.style.display = 'none';
      }

      viewAllBtn.classList.add('hidden');
    }

    // Modal List
    if (modalTaskList) {
      filtered.forEach(task => {
        modalTaskList.appendChild(createTaskRowElement(task));
      });
    }

    updateStats();
  }

  /* ----------------------------------------------------------
     ADD / EDIT / DELETE / TOGGLE TASK
     ---------------------------------------------------------- */
  function addTask() {
    const title = taskInput.value.trim();

    if (!title) {
      taskInput.focus();
      showToast('Please enter a task title');
      return;
    }

    tasks.unshift({
      id: uid(),
      title: title,
      completed: false,
      deadline: deadlineInput.value || '',
      priority: priorityInput ? priorityInput.value : 'none',
      recurring: recurringInput.value || 'none',
      note: noteInput.value.trim() || ''
    });

    saveTasks();
    render();
    resetOptionForm();
    taskInput.focus();
    showToast('Task added');
  }

  function getNextDeadline(isoStr, recurringType) {
    let date;
    if (isoStr) {
      date = new Date(isoStr);
    }
    if (!date || isNaN(date.getTime())) {
      date = new Date();
    }

    if (recurringType === 'daily') {
      date.setDate(date.getDate() + 1);
    } else if (recurringType === 'weekly') {
      date.setDate(date.getDate() + 7);
    } else if (recurringType === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    }

    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.completed && task.recurring && task.recurring !== 'none') {
      const nextDue = getNextDeadline(task.deadline, task.recurring);
      task.deadline = nextDue;
      saveTasks();
      render();
      showToast(`🔁 Rescheduled (${formatRepeatText(task.recurring)}) for ${formatShortDate(nextDue)}`);
      return;
    }

    task.completed = !task.completed;
    saveTasks();
    render();
    showToast(task.completed ? 'Task completed' : 'Task reopened');
  }

  function deleteTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    tasks.splice(index, 1);
    expandedNotes.delete(id);
    saveTasks();
    render();
    showToast('Task deleted');
  }

  function startEditTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    taskInput.value = task.title;
    deadlineInput.value = task.deadline || '';
    if (priorityInput) {
      if (typeof task.priority === 'string') {
        priorityInput.value = task.priority;
      } else {
        const w = getPriorityWeight(task.priority);
        priorityInput.value = w === 3 ? 'high' : w === 2 ? 'medium' : w === 1 ? 'low' : 'none';
      }
    }
    recurringInput.value = task.recurring || 'none';
    noteInput.value = task.note || '';

    todoOptions.classList.remove('hidden');
    toggleOptionsBtn.classList.add('active');

    taskInput.focus();
    editingId = id;
    addTaskBtn.textContent = 'Save';

    showToast('Editing task — make changes and click Save');
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
      task.priority = priorityInput ? priorityInput.value : 'none';
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
    addTaskBtn.textContent = 'Add task';
  }

  function resetOptionForm() {
    taskInput.value = '';
    deadlineInput.value = '';
    if (priorityInput) priorityInput.value = 'none';
    recurringInput.value = 'none';
    noteInput.value = '';
    todoOptions.classList.add('hidden');
    toggleOptionsBtn.classList.remove('active');
  }

  /* ----------------------------------------------------------
     EVENT LISTENERS
     ---------------------------------------------------------- */
  toggleOptionsBtn.addEventListener('click', () => {
    todoOptions.classList.toggle('hidden');
    toggleOptionsBtn.classList.toggle('active');
  });

  priorityInput.addEventListener('input', (e) => {
    priorityValue.textContent = `${e.target.value}%`;
  });

  addTaskBtn.addEventListener('click', () => {
    if (editingId) saveEdit();
    else addTask();
  });

  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingId) saveEdit();
      else addTask();
    }
    if (e.key === 'Escape' && editingId) cancelEdit();
  });

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    render();
  });

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('filter--active'));
      btn.classList.add('filter--active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => modal.classList.add('open'));
  }
  if (modalClose) {
    modalClose.addEventListener('click', () => modal.classList.remove('open'));
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', () => modal.classList.remove('open'));
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (e) { /* ignore */ }
  });

  (function initTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light') {
        document.body.classList.remove('dark');
        document.body.classList.add('light');
        themeIcon.textContent = '🌙';
      }
    } catch (e) { /* ignore */ }
  })();

  /* ----------------------------------------------------------
     FOCUS TIMER LOGIC
     ---------------------------------------------------------- */
  const presetButtons        = document.querySelectorAll('.preset-btn');
  const customPresetToggle   = document.getElementById('customPresetToggle');
  const customTimePicker     = document.getElementById('customTimePicker');
  const customMinutesInput   = document.getElementById('customMinutesInput');
  const setCustomTimeBtn     = document.getElementById('setCustomTimeBtn');

  const timerDisplay         = document.getElementById('timerDisplay');
  const timerStartBtn        = document.getElementById('timerStartBtn');
  const timerStartText       = document.getElementById('timerStartText');
  const timerResetBtn        = document.getElementById('timerResetBtn');

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

    if (timerIsRunning) {
      document.title = `(${formatTimerTime(timerRemainingSeconds)}) Taskly`;
    } else {
      document.title = 'Taskly — Stay Organized';
    }
  }

  function setTimerSeconds(seconds) {
    pauseTimer();
    timerTotalSeconds = seconds;
    timerRemainingSeconds = seconds;
    updateTimerUI();
  }

  function startTimer() {
    if (timerIsRunning) return;
    timerIsRunning = true;
    if (timerStartText) timerStartText.textContent = 'Pause';

    timerInterval = setInterval(() => {
      if (timerRemainingSeconds > 0) {
        timerRemainingSeconds--;
        updateTimerUI();
      } else {
        pauseTimer();
        showToast('🎉 Focus Session completed!');
      }
    }, 1000);
  }

  function pauseTimer() {
    timerIsRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    if (timerStartText) timerStartText.textContent = 'Start';
    updateTimerUI();
  }

  function resetTimer() {
    pauseTimer();
    timerRemainingSeconds = timerTotalSeconds;
    updateTimerUI();
  }

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn === customPresetToggle) {
        presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (customTimePicker) customTimePicker.classList.toggle('hidden');
        return;
      }

      if (customTimePicker) customTimePicker.classList.add('hidden');
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const seconds = parseInt(btn.dataset.time, 10) || 1500;
      setTimerSeconds(seconds);
    });
  });

  if (setCustomTimeBtn) {
    setCustomTimeBtn.addEventListener('click', () => {
      const mins = parseInt(customMinutesInput.value, 10);
      if (isNaN(mins) || mins <= 0) {
        showToast('Please enter valid minutes (1-300)');
        return;
      }
      setTimerSeconds(mins * 60);
      showToast(`Timer set to ${mins} min${mins === 1 ? '' : 's'}`);
    });
  }

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