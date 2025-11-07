import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Alert, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Menu, Provider } from "react-native-paper";

/* --------------------
   Notification handler
   -------------------- */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEY = "@tasks_v2";

export default function App() {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");

  const [category, setCategory] = useState("");
  const [reminderDate, setReminderDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [offsetMinutes, setOffsetMinutes] = useState(5);
  const [repeatType, setRepeatType] = useState("none");

  /* --------------------
     Lifecycle
     -------------------- */
  useEffect(() => { loadTasks(); }, []);
  useEffect(() => { saveTasks(); }, [tasks]);

  // 🔄 Controllo aggiornamenti automatico all'avvio
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            "Nuova versione disponibile",
            "È disponibile un aggiornamento dell'app. Vuoi installarlo ora?",
            [
              { text: "Più tardi", style: "cancel" },
              {
                text: "Aggiorna ora",
                onPress: async () => {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                },
              },
            ]
          );
        }
      } catch (error) {
        console.log("Errore durante il controllo aggiornamenti:", error);
      }
    };

    checkForUpdates();
  }, []);

  // 🔔 Permessi notifiche
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permessi notifiche", "Abilita le notifiche per ricevere i promemoria.");
      }
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    })();
  }, []);

  /* --------------------
     Storage
     -------------------- */
  const saveTasks = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) { console.log("saveTasks err", e); }
  };

  const loadTasks = async () => {
    try {
      const s = await AsyncStorage.getItem(STORAGE_KEY);
      if (s) setTasks(JSON.parse(s));
    } catch (e) { console.log("loadTasks err", e); }
  };

  /* --------------------
     Notification utils
     -------------------- */
  const scheduleReminder = async (text, eventDate, offsetMin, repeat) => {
    if (!eventDate) return null;
    const offsetMs = offsetMin * 60 * 1000;
    const triggerDate = new Date(eventDate.getTime() - offsetMs);
    if (triggerDate <= new Date()) return null;

    try {
      let trigger = triggerDate;
      if (repeat === "daily") {
        trigger = { hour: triggerDate.getHours(), minute: triggerDate.getMinutes(), repeats: true };
      } else if (repeat === "weekly") {
        trigger = { weekday: triggerDate.getDay() || 7, hour: triggerDate.getHours(), minute: triggerDate.getMinutes(), repeats: true };
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: { title: "⏰ Promemoria", body: text, sound: true },
        trigger,
      });
      return id;
    } catch (e) {
      console.log("scheduleReminder err", e);
      return null;
    }
  };

  const cancelReminder = async (notificationId) => {
    try {
      if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (e) { console.log("cancelReminder err", e); }
  };

  /* --------------------
     Task operations
     -------------------- */
  const addOrUpdateTask = async () => {
    if (task.trim() === "") return;

    const newTask = {
      id: editId || Date.now().toString(),
      text: task.trim(),
      done: false,
      priority: "low",
      category: category || "Generale",
      reminderDate: reminderDate ? reminderDate.toISOString() : null,
      offsetMinutes,
      repeatType,
      notificationId: null,
      createdAt: new Date().toISOString(),
    };

    let newTasks = [...tasks];
    const index = newTasks.findIndex(t => t.id === editId);

    if (index !== -1) {
      const old = newTasks[index];
      if (old.notificationId) await cancelReminder(old.notificationId);
      if (reminderDate) {
        const notifId = await scheduleReminder(newTask.text, new Date(reminderDate), offsetMinutes, repeatType);
        newTask.notificationId = notifId;
      }
      newTasks[index] = newTask;
    } else {
      if (reminderDate) {
        const notifId = await scheduleReminder(newTask.text, new Date(reminderDate), offsetMinutes, repeatType);
        newTask.notificationId = notifId;
      }
      newTasks.push(newTask);
    }

    setTasks(newTasks);
    resetModal();
  };

  const resetModal = () => {
    setTask("");
    setCategory("");
    setReminderDate(null);
    setOffsetMinutes(5);
    setRepeatType("none");
    setEditId(null);
    setModalVisible(false);
  };

  const toggleTask = (id) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
  };

  const confirmDeleteTask = (id) => {
    Alert.alert("Conferma", "Vuoi davvero eliminare questa attività?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          const t = tasks.find(x => x.id === id);
          if (t?.notificationId) await cancelReminder(t.notificationId);
          setTasks(tasks.filter(t => t.id !== id));
        },
      },
    ]);
  };

  const editTask = (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    setTask(t.text);
    setCategory(t.category || "");
    setReminderDate(t.reminderDate ? new Date(t.reminderDate) : null);
    setOffsetMinutes(t.offsetMinutes ?? 5);
    setRepeatType(t.repeatType || "none");
    setEditId(id);
    setModalVisible(true);
  };

  const updatePriority = (id, newPriority) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, priority: newPriority } : t
    );
    setTasks(updated);
  };

  /* --------------------
     Filters & sorting
     -------------------- */
  const filteredTasks = tasks
    .filter(t => t.text.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "priority") {
        const order = { high: 2, medium: 1, low: 0 };
        return order[b.priority] - order[a.priority];
      }
      if (sortBy === "done") return a.done === b.done ? 0 : a.done ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const humanCountdown = (isoDate) => {
    if (!isoDate) return "";
    const diff = new Date(isoDate) - new Date();
    if (diff <= 0) return "⏰ Promemoria passato";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    if (days > 0) return `⏳ ${days}g ${hours}h`;
    if (hours > 0) return `🕐 ${hours}h ${mins}m`;
    return `🕒 ${mins}m`;
  };

  /* --------------------
     Render
     -------------------- */
  return (
    <Provider>
      <View style={styles.container}>
        <Text style={styles.title}>My Tasks</Text>

        {/* Mostra versione app */}
        <Text style={{ textAlign: "center", color: "#888", marginBottom: 8 }}>
          Versione {Constants.expoConfig?.version || "1.0.0"}
        </Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Cerca attività..."
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.filterRow}>
          {["default", "priority", "done"].map((t) => (
            <TouchableOpacity key={t} onPress={() => setSortBy(t)}>
              <Text style={sortBy === t ? styles.activeSort : styles.filterText}>
                {t === "default" ? "Predefinito" : t === "priority" ? "Priorità" : "Stato"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskItem
              item={item}
              onToggle={() => toggleTask(item.id)}
              onEdit={() => editTask(item.id)}
              onDelete={() => confirmDeleteTask(item.id)}
              onChangePriority={(prio) => updatePriority(item.id, prio)}
              humanCountdown={humanCountdown}
            />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />

        {/* Modal per nuova/modifica attività */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={resetModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>
                {editId ? "Modifica attività" : "Nuova attività"}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Descrizione attività"
                value={task}
                onChangeText={setTask}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Categoria (es. Lavoro, Casa...)"
                value={category}
                onChangeText={setCategory}
              />

              {/* Promemoria */}
              <TouchableOpacity
                style={styles.reminderBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.reminderText}>
                  {reminderDate
                    ? `Promemoria: ${new Date(reminderDate).toLocaleString()}`
                    : "Aggiungi promemoria"}
                </Text>
              </TouchableOpacity>

              {/* Date Picker */}
              {showDatePicker && (
                <DateTimePicker
                  value={reminderDate || new Date()}
                  mode="date"
                  onChange={(e, date) => {
                    setShowDatePicker(false);
                    if (date) setReminderDate(date), setShowTimePicker(true);
                  }}
                />
              )}

              {/* Time Picker */}
              {showTimePicker && (
                <DateTimePicker
                  value={reminderDate || new Date()}
                  mode="time"
                  onChange={(e, time) => {
                    setShowTimePicker(false);
                    if (time) {
                      const d = reminderDate || new Date();
                      d.setHours(time.getHours());
                      d.setMinutes(time.getMinutes());
                      setReminderDate(d);
                    }
                  }}
                />
              )}

              {/* Offset */}
              <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 10 }}>
                {[5, 10, 15].map((min) => (
                  <TouchableOpacity
                    key={min}
                    style={[
                      styles.offsetBtn,
                      offsetMinutes === min && styles.offsetActive,
                    ]}
                    onPress={() => setOffsetMinutes(min)}
                  >
                    <Text
                      style={[
                        styles.offsetText,
                        offsetMinutes === min && styles.offsetActiveText,
                      ]}
                    >
                      {min} min prima
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Ripetizione */}
              <View style={styles.repeatRow}>
                {["none", "daily", "weekly"].map((type) => (
                  <TouchableOpacity key={type} onPress={() => setRepeatType(type)}>
                    <Text
                      style={[
                        styles.repeatOption,
                        repeatType === type && styles.activeRepeat,
                      ]}
                    >
                      {type === "none"
                        ? "Nessuna"
                        : type === "daily"
                        ? "Giornaliera"
                        : "Settimanale"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pulsanti */}
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={resetModal}>
                  <Text style={styles.cancelText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={addOrUpdateTask}>
                  <Text style={styles.saveText}>Salva</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Floating Button */}
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      </View>
    </Provider>
  );
}

/* --------------------
   Componente singolo Task
   -------------------- */
function TaskItem({ item, onToggle, onEdit, onDelete, onChangePriority, humanCountdown }) {
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const priorityColor =
    item.priority === "high"
      ? "#e55039"
      : item.priority === "medium"
      ? "#f6b93b"
      : "#78e08f";

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        onPress={onToggle}
        style={[
          styles.card,
          { borderLeftColor: priorityColor },
          item.done && styles.doneCard,
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.cardText, item.done && styles.doneText]}>{item.text}</Text>
            <Text style={styles.categoryText}>📁 {item.category}</Text>
            {item.reminderDate && <Text style={styles.dueDate}>{humanCountdown(item.reminderDate)}</Text>}
          </View>

          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <TouchableOpacity onPress={openMenu} style={{ padding: 6 }}>
                <Text style={{ fontSize: 22 }}>⋯</Text>
              </TouchableOpacity>
            }
          >
            <Menu.Item onPress={() => { closeMenu(); onEdit(); }} title="Modifica" />
            <Menu.Item onPress={() => { closeMenu(); onDelete(); }} title="Elimina" />
            <Menu.Item title="Priorità" disabled />
            <Menu.Item onPress={() => { closeMenu(); onChangePriority("low"); }} title="Low" />
            <Menu.Item onPress={() => { closeMenu(); onChangePriority("medium"); }} title="Medium" />
            <Menu.Item onPress={() => { closeMenu(); onChangePriority("high"); }} title="High" />
          </Menu>
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* --------------------
   Styles
   -------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", paddingTop: 50 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", color: "#4e73df", marginBottom: 12 },
  searchInput: {
    backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: "#e6e6e6",
  },
  filterRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  filterText: { color: "#444" },
  activeSort: { color: "#4e73df", fontWeight: "700", textDecorationLine: "underline" },
  cardWrapper: { marginHorizontal: 16, marginBottom: 14 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 6,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  cardText: { fontSize: 17, fontWeight: "500", color: "#333" },
  doneCard: { opacity: 0.6 },
  doneText: { textDecorationLine: "line-through", color: "#888" },
  categoryText: { fontSize: 13, color: "#777", marginTop: 3 },
  dueDate: { fontSize: 13, color: "#4e73df", marginTop: 3 },

  fab: {
    position: "absolute", right: 20, bottom: 30, backgroundColor: "#4e73df", width: 58, height: 58,
    borderRadius: 29, justifyContent: "center", alignItems: "center", elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 32, marginTop: -3 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "85%", shadowColor: "#000",
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#4e73df", marginBottom: 14, textAlign: "center" },
  modalInput: {
    backgroundColor: "#f5f6fa", borderRadius: 10, padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: "#ddd",
  },
  reminderBtn: {
    backgroundColor: "#eaf1ff", borderRadius: 10, padding: 10, marginBottom: 10, alignItems: "center",
  },
  reminderText: { color: "#4e73df" },
  offsetBtn: {
    backgroundColor: "#f0f0f0", paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, marginHorizontal: 5,
  },
  offsetActive: { backgroundColor: "#4e73df" },
  offsetText: { color: "#333" },
  offsetActiveText: { color: "#fff" },
  repeatRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  repeatOption: { color: "#666", padding: 5 },
  activeRepeat: { color: "#4e73df", fontWeight: "600", textDecorationLine: "underline" },
  modalButtons: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  cancelText: { color: "#e55039", fontSize: 16 },
  saveBtn: { backgroundColor: "#4e73df", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
