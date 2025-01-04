# Mic Splice

## Sets and Functions

1. $P$ — the set of participants (anonymous until named).  
2. $\mathrm{track}: P \to \mathit{AudioTrack} \cup \{\bot\}$ — the active local audio track for each participant.  
3. $\mathrm{subscribeState}: P \to \{\text{none}, \text{lowBW}\}$ — each participant's subscription state (no full audio playback).  
4. $\mathrm{sessionActive} \in \{\text{true}, \text{false}\}$ — indicates if a recording session is currently in progress.  
5. $\mathrm{multitrackFiles} \subseteq \mathcal{P}(\mathit{AudioFile})$ — the set of finalized session recordings (each file = separate channels per participant).  
6. $\mathrm{currentRecording} \in \mathit{AudioFile} \cup \{\bot\}$ — the in-progress multitrack file (or $\bot$ if no active session).  
7. $\mathrm{S3Bucket}$ — the configured S3-compatible storage.  
8. $\mathrm{S3Notification}$ — mechanism that fires when new uploads appear, so the system can refresh download links.

---

## Invariants

1. **Always No Video**  
   $$
   \forall p \in P:\ \mathrm{track}(p).\mathrm{kind} = \text{audio-only}
   $$
   *(No participant ever establishes a video track.)*  

2. **No Audio Playback**  
   $$
   \forall p \in P:\ \mathrm{subscribeState}(p) = \text{lowBW} \implies \text{audio-element is muted}
   $$
   *(Playback is always muted; only minimal "speaking indicator" subscriptions.)*  

3. **User-Initiated Recording**  
   - A recording session starts only when a participant clicks "Record."
   - The session continues until stopped or all participants leave.

4. **Unified Timeline**  
   $\mathrm{currentRecording}$ continues on the server even if any $p \in P$ disconnects.  

5. **Finalization Required for Download**  
   $$
   \text{Only } f \in \mathrm{multitrackFiles} \text{ (finalized) can be downloaded.}
   $$

6. **S3-Compatible Upload**  
   $$
   \forall f \in \mathrm{multitrackFiles}:\ f \text{ is stored in } \mathrm{S3Bucket}
   $$
   *(Recorded files automatically upload via S3-compatible APIs.)*

7. **S3 Notifications**  
   - Whenever the bucket changes (new file or updated file), $\mathrm{S3Notification}$ is fired, prompting the UI to fetch updated file links.

---

## Events and Transitions

1. **Join**  
   - **Trigger:** A new participant $p$ arrives.  
   - **Effects:**  
     $$
     P \leftarrow P \cup \{p\}; \quad
     \mathrm{track}(p) \leftarrow \text{new AudioTrack}(\text{defaultMic}); \quad
     \mathrm{subscribeState}(p) \leftarrow \text{lowBW}
     $$

2. **Start Recording**  
   - **Trigger:** A participant clicks "Record."  
   - **Effects:**  
     - If $\mathrm{sessionActive} = \text{true}$, finalize the current recording:
       $$
       \mathrm{multitrackFiles} \leftarrow
       \mathrm{multitrackFiles} \cup \{\mathrm{currentRecording}\}; \quad
       \mathrm{currentRecording} \text{ is pushed to } \mathrm{S3Bucket}
       $$
     - Begin a fresh server-side recording:
       $$
       \mathrm{sessionActive} \leftarrow \text{true}; \quad
       \mathrm{currentRecording} \leftarrow \text{new LiveKitRecordingHandle}
       $$

3. **Stop Recording**  
   - **Trigger:** A participant clicks "Stop."  
   - **Effects:**  
     $$
     \mathrm{multitrackFiles} \leftarrow
     \mathrm{multitrackFiles} \cup \{\mathrm{currentRecording}\}; \quad
     \mathrm{currentRecording} \rightarrow \mathrm{S3Bucket}; \quad
     \mathrm{currentRecording} \leftarrow \bot; \quad
     \mathrm{sessionActive} \leftarrow \text{false}
     $$
   - *(Files remain available for download after they have been finalized.)*

4. **Download**  
   - **Trigger:** A participant requests any previously finalized file $f$.  
   - **Precondition:** $f \in \mathrm{multitrackFiles}$.  
   - **Effect:** Return a download link from $\mathrm{S3Bucket}$.

5. **S3 Bucket Update**  
   - **Trigger:** $\mathrm{S3Notification}$ fires when new uploads appear.  
   - **Effect:** The UI refreshes with updated file links.

6. **Leave**  
   - **Trigger:** Participant $p$ leaves.  
   - **Effects:**  
     $$
     P \leftarrow P \setminus \{p\}; \quad
     \mathrm{track}(p) \leftarrow \bot
     $$
     If $P = \varnothing$ and $\mathrm{sessionActive} = \text{true}$, then finalize:
     $$
     \mathrm{multitrackFiles} \leftarrow \mathrm{multitrackFiles}
        \cup \{\mathrm{currentRecording}\}; \quad
     \mathrm{currentRecording} \rightarrow \mathrm{S3Bucket}; \quad
     \mathrm{sessionActive} \leftarrow \text{false}; \quad
     \mathrm{currentRecording} \leftarrow \bot
     $$
