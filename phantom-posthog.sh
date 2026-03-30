#!/bin/bash
# Simulate real user journeys sending events directly to PostHog
PH_URL="https://eu.i.posthog.com/capture/"
API_KEY="phc_EEqgqRdu0cVisqA6XKztIEKrnX3O8d8sYooVfyowd0c"

QUESTIONS=("sexo" "edad" "problema" "tiempo" "probado" "impacto" "conocimiento" "motivacion" "expectativa" "inversion" "formato" "captura")

send_event() {
  local event="$1" distinct_id="$2" props="$3"
  curl -s -X POST "$PH_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"api_key\": \"$API_KEY\",
      \"event\": \"$event\",
      \"distinct_id\": \"$distinct_id\",
      \"properties\": {
        \"\$current_url\": \"https://hospitalcapilarquiz.netlify.app/\",
        \"\$host\": \"hospitalcapilarquiz.netlify.app\",
        \"\$lib\": \"web\",
        \"\$process_person_profile\": true,
        $props
      },
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
    }" > /dev/null 2>&1
}

# Simulate a full journey
full_journey() {
  local id="$1" device="$2" source="$3" total="${4:-12}"
  echo "  User $id ($device, $source): Full journey"

  send_event "screen_viewed" "$id" "\"screen_type\":\"welcome\",\"screen_id\":\"welcome\",\"device_type\":\"$device\",\"utm_source\":\"$source\""
  send_event "quiz_started" "$id" "\"device_type\":\"$device\",\"utm_source\":\"$source\""

  for i in $(seq 0 $((total - 1))); do
    send_event "screen_viewed" "$id" "\"screen_type\":\"question\",\"screen_id\":\"${QUESTIONS[$i]:-q$i}\",\"screen_index\":$i,\"total_screens\":$total,\"progress_pct\":$((i * 100 / total)),\"device_type\":\"$device\""
    send_event "question_answered" "$id" "\"question_id\":\"${QUESTIONS[$i]:-q$i}\",\"question_index\":$i,\"device_type\":\"$device\""
    sleep 0.1
  done

  send_event "screen_viewed" "$id" "\"screen_type\":\"contact_form\",\"screen_id\":\"captura\",\"screen_index\":$((total-1)),\"total_screens\":$total,\"device_type\":\"$device\""
  send_event "form_field_focused" "$id" "\"field\":\"nombre\",\"device_type\":\"$device\""
  send_event "form_field_focused" "$id" "\"field\":\"email\",\"device_type\":\"$device\""
  send_event "form_field_focused" "$id" "\"field\":\"telefono\",\"device_type\":\"$device\""
  send_event "form_submitted" "$id" "\"has_name\":true,\"has_email\":true,\"has_phone\":true,\"device_type\":\"$device\""
  send_event "quiz_result" "$id" "\"ecp\":\"ECP1\",\"frame\":\"FRAME_A\",\"score\":75,\"total_time_seconds\":180,\"sexo\":\"hombre\",\"device_type\":\"$device\",\"utm_source\":\"$source\""
  send_event "screen_viewed" "$id" "\"screen_type\":\"results\",\"screen_id\":\"results\",\"frame\":\"FRAME_A\",\"device_type\":\"$device\""
}

# Simulate abandonment at a specific step
abandon_at() {
  local id="$1" device="$2" source="$3" drop_step="$4" total="12"
  echo "  User $id ($device, $source): Abandons at step $drop_step (${QUESTIONS[$drop_step]:-q$drop_step})"

  send_event "screen_viewed" "$id" "\"screen_type\":\"welcome\",\"screen_id\":\"welcome\",\"device_type\":\"$device\",\"utm_source\":\"$source\""
  send_event "quiz_started" "$id" "\"device_type\":\"$device\",\"utm_source\":\"$source\""

  for i in $(seq 0 $drop_step); do
    send_event "screen_viewed" "$id" "\"screen_type\":\"question\",\"screen_id\":\"${QUESTIONS[$i]:-q$i}\",\"screen_index\":$i,\"total_screens\":$total,\"progress_pct\":$((i * 100 / total)),\"device_type\":\"$device\""
    if [ $i -lt $drop_step ]; then
      send_event "question_answered" "$id" "\"question_id\":\"${QUESTIONS[$i]:-q$i}\",\"question_index\":$i,\"device_type\":\"$device\""
    fi
    sleep 0.1
  done

  local pct=$((drop_step * 100 / total))
  send_event "quiz_abandoned" "$id" "\"last_screen_id\":\"${QUESTIONS[$drop_step]}\",\"last_screen_index\":$drop_step,\"last_screen_type\":\"question\",\"total_screens\":$total,\"progress_pct\":$pct,\"device_type\":\"$device\""
}

# Simulate form abandonment (reached form but didn't submit)
abandon_form() {
  local id="$1" device="$2" source="$3" total="12"
  echo "  User $id ($device, $source): Abandons at contact form"

  send_event "screen_viewed" "$id" "\"screen_type\":\"welcome\",\"screen_id\":\"welcome\",\"device_type\":\"$device\",\"utm_source\":\"$source\""
  send_event "quiz_started" "$id" "\"device_type\":\"$device\",\"utm_source\":\"$source\""

  for i in $(seq 0 $((total - 1))); do
    send_event "screen_viewed" "$id" "\"screen_type\":\"question\",\"screen_id\":\"${QUESTIONS[$i]:-q$i}\",\"screen_index\":$i,\"total_screens\":$total,\"progress_pct\":$((i * 100 / total)),\"device_type\":\"$device\""
    send_event "question_answered" "$id" "\"question_id\":\"${QUESTIONS[$i]:-q$i}\",\"question_index\":$i,\"device_type\":\"$device\""
    sleep 0.1
  done

  send_event "screen_viewed" "$id" "\"screen_type\":\"contact_form\",\"screen_id\":\"captura\",\"screen_index\":$((total-1)),\"total_screens\":$total,\"device_type\":\"$device\""
  send_event "form_field_focused" "$id" "\"field\":\"nombre\",\"device_type\":\"$device\""
  send_event "quiz_abandoned" "$id" "\"last_screen_id\":\"captura\",\"last_screen_index\":$((total-1)),\"last_screen_type\":\"contact_form\",\"total_screens\":$total,\"progress_pct\":92,\"device_type\":\"$device\""
}

echo "============================================"
echo "POSTHOG PHANTOM TESTS"
echo "============================================"

echo ""
echo "--- COMPLETED JOURNEYS (15 users) ---"
full_journey "user-complete-01" "mobile" "google" 12
full_journey "user-complete-02" "desktop" "google" 12
full_journey "user-complete-03" "mobile" "instagram" 12
full_journey "user-complete-04" "desktop" "direct" 12
full_journey "user-complete-05" "mobile" "tiktok" 12
full_journey "user-complete-06" "mobile" "google" 11
full_journey "user-complete-07" "desktop" "instagram" 12
full_journey "user-complete-08" "mobile" "direct" 12
full_journey "user-complete-09" "desktop" "google" 12
full_journey "user-complete-10" "mobile" "facebook" 12
full_journey "user-complete-11" "desktop" "direct" 12
full_journey "user-complete-12" "mobile" "google" 12
full_journey "user-complete-13" "mobile" "instagram" 11
full_journey "user-complete-14" "desktop" "tiktok" 12
full_journey "user-complete-15" "mobile" "google" 12

echo ""
echo "--- ABANDONED AT FIRST QUESTION (5 users) ---"
abandon_at "user-drop-q0-01" "mobile" "google" 0
abandon_at "user-drop-q0-02" "mobile" "tiktok" 0
abandon_at "user-drop-q0-03" "mobile" "instagram" 0
abandon_at "user-drop-q0-04" "desktop" "facebook" 0
abandon_at "user-drop-q0-05" "mobile" "direct" 0

echo ""
echo "--- ABANDONED AT PROBLEMA (step 2) — 4 users ---"
abandon_at "user-drop-q2-01" "mobile" "google" 2
abandon_at "user-drop-q2-02" "desktop" "direct" 2
abandon_at "user-drop-q2-03" "mobile" "instagram" 2
abandon_at "user-drop-q2-04" "mobile" "tiktok" 2

echo ""
echo "--- ABANDONED AT PROBADO (step 4) — 3 users ---"
abandon_at "user-drop-q4-01" "mobile" "google" 4
abandon_at "user-drop-q4-02" "desktop" "google" 4
abandon_at "user-drop-q4-03" "mobile" "direct" 4

echo ""
echo "--- ABANDONED AT IMPACTO (step 5) — 3 users ---"
abandon_at "user-drop-q5-01" "mobile" "instagram" 5
abandon_at "user-drop-q5-02" "mobile" "google" 5
abandon_at "user-drop-q5-03" "desktop" "direct" 5

echo ""
echo "--- ABANDONED AT INVERSION (step 9) — 2 users ---"
abandon_at "user-drop-q9-01" "mobile" "google" 9
abandon_at "user-drop-q9-02" "desktop" "instagram" 9

echo ""
echo "--- ABANDONED AT CONTACT FORM (reached form, didn't submit) — 5 users ---"
abandon_form "user-drop-form-01" "mobile" "google"
abandon_form "user-drop-form-02" "mobile" "instagram"
abandon_form "user-drop-form-03" "desktop" "direct"
abandon_form "user-drop-form-04" "mobile" "tiktok"
abandon_form "user-drop-form-05" "mobile" "facebook"

echo ""
echo "--- WELCOME ONLY (saw page, didn't start) — 5 users ---"
for i in $(seq 1 5); do
  echo "  User user-bounce-0$i: Bounced at welcome"
  send_event "\$pageview" "user-bounce-0$i" "\"\\\$current_url\":\"https://hospitalcapilarquiz.netlify.app/\""
done

echo ""
echo "============================================"
echo "PHANTOM TESTS COMPLETE"
echo "Total: 47 simulated users"
echo "  15 completed quiz"
echo "  22 abandoned at various stages"
echo "  5 abandoned at contact form"
echo "  5 bounced (never started)"
echo "============================================"
