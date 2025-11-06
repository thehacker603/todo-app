import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";

// ✅ Configurazione base per le notifiche
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [menuIndex, setMenuIndex] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [reminderOffset, setReminderOffset] = useState(5); // minuti prima dell’evento

  useEffect(() => { loadTasks(); }, []);
  useEffect(() => { saveTasks(); }, [tasks]);
  useEffect(() => { requestPermissions(); }, []);

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") alert("Le notifiche sono disabilitate");
  };

  const saveTasks = async () => {
    try { await AsyncStorage.setItem("tasks", JSON.stringify(tasks)); }
    catch {}
  };

  const loadTasks = async () => {
    try {
      const storedTasks = await AsyncStorage.getItem("tasks");
      if (storedTasks) setTasks(JSON.parse(storedTasks));
    } catch {}
  };

  const scheduleNotification = async (text, when) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ Promemoria attività",
          body: text,
        },
        trigger: when,
      });
    } catch (e) {
      console.log("Errore notifica:", e);
    }
  };

  const addTask = async () => {
    if (task.trim() === "") return;

    const newTask = {
      text: task,
      done: false,
      priority: "low",
      reminder: reminderTime.toISOString(),
    };

    setTasks([...tasks, newTask]);
    setTask("");
    setModalVisible(false);

    // Calcola l’orario di notifica (offset prima)
    const triggerTime = new Date(reminderTime.getTime() - reminderOffset * 60 * 1000);
    if (triggerTime > new Date()) {
      await scheduleNotification(task, triggerTime);
    }
  };

  const toggleTask = (i) => {
    const t = [...tasks];
    t[i].done = !t[i].done;
    setTasks(t);
  };

  const deleteTask = (i) => {
    setTasks(tasks.filter((_, x) => x !== i));
  };

  const setPriority = (i, p) => {
    const t = [...tasks];
    t[i].priority = p;
    setTasks(t);
    setMenuIndex(null);
  };

  const priorityColor = {
    low: "#78e08f",
    medium: "#f6b93b",
    high: "#e55039",
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Tasks</Text>

      <FlatList
        data={tasks}
        renderItem={({ item, index }) => (
          <View style={styles.cardWrapper}>
            <TouchableOpacity
              onPress={() => toggleTask(index)}
              style={[
                styles.card,
                { borderLeftColor: priorityColor[item.priority] },
                item.done && styles.doneCard
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.cardText, item.done && styles.doneText]}>{item.text}</Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.badge, { backgroundColor: priorityColor[item.priority] }]}>
                    {item.priority.toUpperCase()}
                  </Text>

                  <TouchableOpacity onPress={() => deleteTask(index)}>
                    <Text style={styles.deleteButton}>🗑️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => setMenuIndex(menuIndex === index ? null : index)}
                  >
                    <Text style={styles.menuDots}>⋮</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {item.reminder && (
                <Text style={styles.reminderText}>
                  ⏰ {new Date(item.reminder).toLocaleString()}
                </Text>
              )}
            </TouchableOpacity>

            {menuIndex === index && (
              <View style={styles.menuBox}>
                <TouchableOpacity onPress={() => setPriority(index, "low")}><Text style={styles.menuItem}>⬇️ Bassa</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPriority(index, "medium")}><Text style={styles.menuItem}>〰️ Media</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPriority(index, "high")}><Text style={styles.menuItem}>⬆️ Alta</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
        keyExtractor={(item, index) => index.toString()}
      />

      {/* ✅ MODAL PER AGGIUNGERE TASK */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuova attività</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Scrivi la tua task..."
              value={task}
              onChangeText={setTask}
              placeholderTextColor="#aaa"
            />

            <TouchableOpacity onPress={() => setShowPicker(true)}>
              <Text style={styles.dateBtn}>📅 Scegli data/ora promemoria</Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={reminderTime}
                mode="datetime"
                display="default"
                onChange={(e, selectedDate) => {
                  setShowPicker(false);
                  if (selectedDate) setReminderTime(selectedDate);
                }}
              />
            )}

            <View style={styles.offsetRow}>
              <Text>Avviso prima di:</Text>
              <TouchableOpacity onPress={() => setReminderOffset(5)}>
                <Text style={[styles.offsetBtn, reminderOffset === 5 && styles.offsetActive]}>5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReminderOffset(60)}>
                <Text style={[styles.offsetBtn, reminderOffset === 60 && styles.offsetActive]}>1 ora</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReminderOffset(1440)}>
                <Text style={[styles.offsetBtn, reminderOffset === 1440 && styles.offsetActive]}>1 giorno</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={addTask}>
                <Text style={styles.saveText}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ FLOATING BUTTON */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: "#f8f9fa" },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: 10 },
  cardWrapper: { marginHorizontal: 16, marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardText: { fontSize: 16, fontWeight: "500" },
  doneCard: { opacity: 0.5 },
  doneText: { textDecorationLine: "line-through" },
  badge: { paddingHorizontal: 10, paddingVertical: 2, color: "#fff", fontWeight: "700", borderRadius: 20, fontSize: 11 },
  deleteButton: { fontSize: 18 },
  menuDots: { fontSize: 20, textAlign: "center" },
  menuButton: { padding: 10, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  reminderText: { fontSize: 12, color: "#666", marginTop: 6 },
  menuBox: { backgroundColor: "#fff", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#ccc", marginTop: 5 },
  menuItem: { paddingVertical: 6, fontSize: 14 },
  dateBtn: { color: "#4e73df", marginVertical: 10, textAlign: "center" },
  offsetRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginVertical: 8 },
  offsetBtn: { padding: 6, borderRadius: 6, borderWidth: 1, borderColor: "#ccc" },
  offsetActive: { backgroundColor: "#4e73df", color: "#fff", borderColor: "#4e73df" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#4e73df",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5
  },
  fabText: { fontSize: 34, color: "#fff", lineHeight: 34 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalBox: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    elevation: 5
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 15
  },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  cancelBtn: { padding: 10 },
  cancelText: { color: "#555", fontSize: 16 },
  saveBtn: { backgroundColor: "#4e73df", padding: 10, borderRadius: 10 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" }
});
