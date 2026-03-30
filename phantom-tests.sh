#!/bin/bash
# Phantom tests - all quiz paths
URL="https://hospitalcapilarquiz.netlify.app/.netlify/functions/ghl-proxy"
LOC="U4SBRYIlQtGBDHLFwEUf"

send() {
  local name="$1" email="$2" phone="$3" city="$4" tags="$5" source="$6"
  echo "Sending: $name ($email) — tags: $tags"
  curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"locationId\": \"$LOC\",
      \"firstName\": \"$name\",
      \"lastName\": \"PhantomTest\",
      \"email\": \"$email\",
      \"phone\": \"$phone\",
      \"city\": \"$city\",
      \"tags\": [$tags],
      \"source\": \"$source\"
    }" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  OK:', d.get('contact',{}).get('id','FAILED'), d.get('error',''))" 2>/dev/null || echo "  FAILED"
  sleep 1
}

echo "=== ECP1: Hombre clasico, caida densidad, Madrid, FRAME_A ==="
send "Carlos" "carlos.ecp1.framea@phantom.test" "+34600100001" "Madrid" \
  '"ECP1","FRAME_A","score-75","src-direct"' "Phantom Test - ECP1 FRAME_A"

echo ""
echo "=== ECP1: Hombre, entradas, Murcia, FRAME_A ==="
send "Miguel" "miguel.ecp1.entradas@phantom.test" "+34600100002" "Murcia" \
  '"ECP1","FRAME_A","score-80","src-direct"' "Phantom Test - ECP1 Entradas"

echo ""
echo "=== ECP1: Hombre frio, info, otra ciudad, FRAME_D ==="
send "Pedro" "pedro.ecp1.framed@phantom.test" "+34600100003" "Otra ciudad" \
  '"ECP1","FRAME_D","score-15","src-direct"' "Phantom Test - ECP1 FRAME_D"

echo ""
echo "=== ECP1: Hombre llamada, FRAME_C ==="
send "Andres" "andres.ecp1.framec@phantom.test" "+34600100004" "Pontevedra" \
  '"ECP1","FRAME_C","score-55","src-direct"' "Phantom Test - ECP1 FRAME_C"

echo ""
echo "=== ECP1: Hombre otra ciudad, WAITLIST ==="
send "Roberto" "roberto.ecp1.waitlist@phantom.test" "+34600100005" "Valencia" \
  '"ECP1","WAITLIST","score-40","src-direct"' "Phantom Test - ECP1 WAITLIST"

echo ""
echo "=== ECP2: Mujer hormonal, Madrid, FRAME_A ==="
send "Maria" "maria.ecp2.framea@phantom.test" "+34600200001" "Madrid" \
  '"ECP2","FRAME_A","score-70","src-direct"' "Phantom Test - ECP2 FRAME_A"

echo ""
echo "=== ECP2: Mujer densidad, Murcia, FRAME_A ==="
send "Laura" "laura.ecp2.densidad@phantom.test" "+34600200002" "Murcia" \
  '"ECP2","FRAME_A","score-65","src-direct"' "Phantom Test - ECP2 Densidad"

echo ""
echo "=== ECP2: Mujer caida general, FRAME_D ==="
send "Ana" "ana.ecp2.framed@phantom.test" "+34600200003" "Otra ciudad" \
  '"ECP2","FRAME_D","score-10","src-direct"' "Phantom Test - ECP2 FRAME_D"

echo ""
echo "=== ECP3: Joven 18-25, nada probado, Madrid, FRAME_A ==="
send "Pablo" "pablo.ecp3.framea@phantom.test" "+34600300001" "Madrid" \
  '"ECP3","FRAME_A","score-50","src-direct"' "Phantom Test - ECP3 FRAME_A"

echo ""
echo "=== ECP3: Joven 18-25, OTC, Pontevedra, FRAME_C ==="
send "Javier" "javier.ecp3.framec@phantom.test" "+34600300002" "Pontevedra" \
  '"ECP3","FRAME_C","score-45","src-direct"' "Phantom Test - ECP3 FRAME_C"

echo ""
echo "=== ECP4: Mala experiencia, FRAME_C (siempre) ==="
send "Diego" "diego.ecp4.framec@phantom.test" "+34600400001" "Madrid" \
  '"ECP4","FRAME_C","score-60","src-direct"' "Phantom Test - ECP4 FRAME_C"

echo ""
echo "=== ECP4: Mala experiencia Insparya, FRAME_C ==="
send "Fernando" "fernando.ecp4.insparya@phantom.test" "+34600400002" "Murcia" \
  '"ECP4","FRAME_C","score-55","src-direct"' "Phantom Test - ECP4 Insparya"

echo ""
echo "=== ECP5: Post-cirugia HC, Madrid, FRAME_A ==="
send "Raul" "raul.ecp5.hc@phantom.test" "+34600500001" "Madrid" \
  '"ECP5","FRAME_A","score-85","src-direct"' "Phantom Test - ECP5 HC"

echo ""
echo "=== ECP5: Post-cirugia Turquia, Pontevedra, FRAME_A ==="
send "Alberto" "alberto.ecp5.turquia@phantom.test" "+34600500002" "Pontevedra" \
  '"ECP5","FRAME_A","score-70","src-direct"' "Phantom Test - ECP5 Turquia"

echo ""
echo "=== ECP6: Mujer postparto, Madrid, FRAME_A ==="
send "Sofia" "sofia.ecp6.framea@phantom.test" "+34600600001" "Madrid" \
  '"ECP6","FRAME_A","score-65","src-direct"' "Phantom Test - ECP6 FRAME_A"

echo ""
echo "=== ECP6: Mujer postparto, otra ciudad, WAITLIST ==="
send "Elena" "elena.ecp6.waitlist@phantom.test" "+34600600002" "Albacete" \
  '"ECP6","WAITLIST","score-35","src-direct"' "Phantom Test - ECP6 WAITLIST"

echo ""
echo "=== DERIVACION: Cuero cabelludo, Madrid ==="
send "Jorge" "jorge.derivacion@phantom.test" "+34600700001" "Madrid" \
  '"DERIVACION","DERIVACION","score-0","src-direct"' "Phantom Test - DERIVACION"

echo ""
echo "=== UTM Test: Google Ads ==="
send "Lucia" "lucia.utm.google@phantom.test" "+34600800001" "Madrid" \
  '"ECP1","FRAME_A","score-70","src-google"' "Quiz HC - google/cpc"

echo ""
echo "=== UTM Test: Instagram ==="
send "Carmen" "carmen.utm.ig@phantom.test" "+34600800002" "Murcia" \
  '"ECP2","FRAME_A","score-60","src-instagram"' "Quiz HC - instagram/paid"

echo ""
echo "=== UTM Test: TikTok ==="
send "Paula" "paula.utm.tiktok@phantom.test" "+34600800003" "Pontevedra" \
  '"ECP1","FRAME_C","score-50","src-tiktok"' "Quiz HC - tiktok/paid"

echo ""
echo "=== Alto score: Hombre critico, abierto inversion, directo ==="
send "Marcos" "marcos.highscore@phantom.test" "+34600900001" "Madrid" \
  '"ECP1","FRAME_A","score-95","src-direct"' "Phantom Test - High Score"

echo ""
echo "=== Bajo score: Hombre poco impacto, info, otra ciudad ==="
send "Ivan" "ivan.lowscore@phantom.test" "+34600900002" "Otra ciudad" \
  '"ECP1","FRAME_D","score-5","src-direct"' "Phantom Test - Low Score"

echo ""
echo "============================================"
echo "PHANTOM TESTS COMPLETE"
echo "Total: 22 test leads sent"
echo "============================================"
