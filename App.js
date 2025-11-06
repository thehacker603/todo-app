import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Alert, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";

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
  const [showPicker, setShowPicker] = useState(false);
  const [offsetMinutes, setOffsetMinutes] = useState(5);
  const [repeatType, setRepeatType] = useState("none");

  useEffect(() => { loadTasks(); }, []);
  useEffect(() => { saveTasks(); }, [tasks]);

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

  const getCategories = () => Array.from(new Set(tasks.map(t => t.category || "Generale")));

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
    <View style={styles.container}>
      <Text style={styles.title}>My Tasks</Text>

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
          <View style={styles.cardWrapper}>
            <TouchableOpacity
              onPress={() => toggleTask(item.id)}
              style={[
                styles.card,
                { borderLeftColor: item.priority === "high" ? "#e55039" : item.priority === "medium" ? "#f6b93b" : "#78e08f" },
                item.done && styles.doneCard
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.cardText, item.done && styles.doneText]}>{item.text}</Text>
                  <Text style={styles.categoryText}>📁 {item.category}</Text>
                  {item.reminderDate && <Text style={styles.dueDate}>{humanCountdown(item.reminderDate)}</Text>}
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.badge, {
                    backgroundColor: item.priority === "high" ? "#e55039" :
                      item.priority === "medium" ? "#f6b93b" : "#78e08f"
                  }]}>
                    {item.priority.toUpperCase()}
                  </Text>

                  <View style={{ flexDirection: "row", marginTop: 6 }}>
                    <TouchableOpacity onPress={() => editTask(item.id)} style={styles.iconHitbox}>
                      <Text style={styles.editIcon}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDeleteTask(item.id)} style={styles.iconHitbox}>
                      <Text style={styles.deleteButton}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editId ? "Modifica attività" : "Nuova attività"}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Descrizione attività"
              value={task}
              onChangeText={setTask}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Categoria (es. Lavoro)"
              value={category}
              onChangeText={setCategory}
            />

            <TouchableOpacity style={styles.reminderBtn} onPress={() => setShowPicker(true)}>
              <Text style={styles.reminderText}>
                {reminderDate
                  ? `Promemoria evento: ${new Date(reminderDate).toLocaleString()}`
                  : "📅 Scegli data/ora evento"}
              </Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={reminderDate ? new Date(reminderDate) : new Date()}
                mode="datetime"
                is24Hour
                display="default"
                onChange={(e, selected) => {
                  setShowPicker(false);
                  if (selected) setReminderDate(selected);
                }}
              />
            )}

            <View style={{ marginTop: 8 }}>
              <Text style={{ marginBottom: 6, color: "#666" }}>Avviso prima dell'evento:</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {[{ label: "5m", val: 5 }, { label: "30m", val: 30 }, { label: "1h", val: 60 }, { label: "1d", val: 1440 }].map(o => (
                  <TouchableOpacity key={o.val} onPress={() => setOffsetMinutes(o.val)}
                    style={[styles.offsetBtn, offsetMinutes === o.val && styles.offsetActive]}>
                    <Text style={offsetMinutes === o.val ? styles.offsetActiveText : styles.offsetText}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={{ marginBottom: 6, color: "#666" }}>Ripetizione:</Text>
              <View style={styles.repeatRow}>
                {["none", "daily", "weekly"].map(r => (
                  <TouchableOpacity key={r} onPress={() => setRepeatType(r)}>
                    <Text style={[styles.repeatOption, repeatType === r && styles.activeRepeat]}>
                      {r === "none" ? "Nessuna" : r === "daily" ? "Giornaliera" : "Settimanale"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={resetModal}>
                <Text style={styles.cancelText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={addOrUpdateTask}>
                <Text style={styles.saveText}>{editId ? "Salva" : "Aggiungi"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

/* --------------------
   Styles (puliti e ordinati)
   -------------------- */
const styles = StyleSheet.create({
  /* palette */
  container: { flex: 1, backgroundColor: "#f8f9fa", paddingTop: 50 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", color: "#4e73df", marginBottom: 12 },

  // search + filters
  searchInput: {
    backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: "#e6e6e6",
  },
  filterRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  filterText: { color: "#444" },
  activeSort: { color: "#4e73df", fontWeight: "700", textDecorationLine: "underline" },

  // card
  cardWrapper: { marginHorizontal: 16, marginBottom: 14 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 6,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  cardText: { fontSize: 17, fontWeight: "600", color: "#222", marginBottom: 4 },
  doneCard: { opacity: 0.6 },
  doneText: { textDecorationLine: "line-through", color: "#8a8a8a" },
  categoryText: { fontSize: 13, color: "#666" },
  dueDate: { fontSize: 12, color: "#e55039", marginTop: 4 },
  badge: { alignSelf: "flex-end", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, color: "#fff", fontWeight: "700", fontSize: 11, marginBottom: 6 },

  // icons
  editIcon: { fontSize: 18, marginHorizontal: 6 },
  deleteButton: { fontSize: 18, marginHorizontal: 6 },
  iconHitbox: { padding: 6, borderRadius: 8 },

  // fab
  fab: {
    position: "absolute", right: 24, bottom: 30, backgroundColor: "#4e73df",
    width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
  },
  fabText: { fontSize: 34, color: "#fff", lineHeight: 36 },

  // modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "88%", backgroundColor: "#fff", borderRadius: 16, paddingVertical: 20, paddingHorizontal: 18, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, elevation: 8 },
  modalTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", color: "#4e73df", marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, marginBottom: 10, backgroundColor: "#fafafa" },

  // category chips
  categoryChip: { backgroundColor: "#f1f3ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  categoryChipText: { color: "#4e73df", fontWeight: "600" },

  // reminder controls
  reminderBtn: { borderWidth: 1, borderColor: "#4e73df", borderRadius: 10, paddingVertical: 10, marginBottom: 8, alignItems: "center" },
  reminderText: { color: "#4e73df", fontWeight: "600" },

  offsetBtn: { flex: 1, borderWidth: 1, borderColor: "#ddd", paddingVertical: 8, marginHorizontal: 4, borderRadius: 8, alignItems: "center" },
  offsetActive: { backgroundColor: "#4e73df", borderColor: "#4e73df" },
  offsetText: { color: "#444", fontWeight: "600" },
  offsetActiveText: { color: "#fff", fontWeight: "700" },

  repeatRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  repeatOption: { fontSize: 14, color: "#555", paddingHorizontal: 10, paddingVertical: 4 },
  activeRepeat: { color: "#4e73df", fontWeight: "700", textDecorationLine: "underline" },

  modalButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  cancelText: { color: "#555", fontSize: 16 },
  saveBtn: { backgroundColor: "#4e73df", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
