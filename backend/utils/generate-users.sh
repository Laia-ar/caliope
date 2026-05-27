#!/bin/bash

NUM_USUARIOS=10
DOMINIO="laia.ar"
DICCIONARIO="diccionario.json"
OUT="usuarios.json"
OUT_TXT="usuarios.txt"
EVENTO=educacion
IS_DISABLED=false

# Función para obtener una palabra aleatoria de una lista del JSON
get_random_word() {
  local categoria=$1
  jq -r ".\"$categoria\"[]" "$DICCIONARIO" | shuf -n 1
}

# Crear archivo JSON base
echo '{"users": []}' > "$OUT"
echo "username,password" > "$OUT_TXT"

for i in $(seq 1 $NUM_USUARIOS); do
  # Username = 2 palabras capitalizadas del conjunto completo
  w1=$(jq -r '[.literatura_y_escritura[], .literatura_latinoamericana[], .creatividad[], .rioplatense_poetico[]] | .[]' "$DICCIONARIO" | shuf -n 1)
  w2=$(jq -r '[.literatura_y_escritura[], .literatura_latinoamericana[], .creatividad[], .rioplatense_poetico[]] | .[]' "$DICCIONARIO" | shuf -n 1)

  username="$(tr '[:lower:]' '[:upper:]' <<< ${w1:0:1})${w1:1}$(tr '[:lower:]' '[:upper:]' <<< ${w2:0:1})${w2:1}"
  email="${EVENTO}${username,,}@${DOMINIO}"
  nombre="Usuario "$((i+243))

  # Password = una palabra de cada categoría, en minúsculas
  p1=$(get_random_word "literatura_y_escritura")
  p2=$(get_random_word "literatura_latinoamericana")
  p3=$(get_random_word "creatividad")
  p4=$(get_random_word "rioplatense_poetico")

  password="${p1}${p2}"

  printf "%s,%s\n" \
    "$username" "$password" >> "$OUT_TXT"

  # Agregar al archivo JSON
  jq --arg u "$username" \
     --arg p "$password" \
     --arg e "$email" \
     --arg n "$nombre" \
     '.users += [{"username": $u, "password": $p, "email": $e, "name": $n ,"is_disabled": false}]' "$OUT" > tmp.json && mv tmp.json "$OUT"
done

echo "✅ Archivo generado: $OUT"
echo "✅ Archivo generado: $OUT_TXT"
