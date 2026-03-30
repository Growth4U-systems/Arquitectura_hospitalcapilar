# UTMs para Campañas — Hospital Capilar

Base URL: `https://diagnostico.hospitalcapilar.com`

## Nichos activos (7 + 1 legacy)

| Slug | Nombre interno | Audiencia |
|---|---|---|
| `jovenes` | El Espejo | Joven 20-28 |
| `mujeres` | Es Normal | Mujer menopausia 45-55 |
| `postparto` | Lo Que Vino Con el Bebé | Postparto 28-38 |
| `que-me-pasa` | ¿Qué Me Pasa? | Gateway sin diagnóstico |
| `segunda-opinion` | Ya Me Engañaron | Insatisfecho otra clínica |
| `farmacia-sin-salida` | La Farmacia Sin Salida | OTC frustrado 2-4 años |
| `post-trasplante` | La Inversión | Post-trasplante sin mantenimiento |
| `hombres-caida` | _(legacy/fallback)_ | Hombre con caída genérico |

---

## Estructura UTM

```
?utm_source={plataforma}&utm_medium={tipo}&utm_campaign={campaña}&utm_content={variante}&utm_term={keyword}
```

| Parámetro | Meta Ads | Google Ads |
|---|---|---|
| `utm_source` | `facebook` o `instagram` | `google` |
| `utm_medium` | `paid_social` | `cpc` |
| `utm_campaign` | nombre de campaña | nombre de campaña |
| `utm_content` | nombre del anuncio | grupo de anuncios |
| `utm_term` | (opcional) | keyword de búsqueda |

> **Nota:** Meta añade `fbclid` automáticamente. Google añade `gclid` automáticamente. Ambos se capturan en el código.

---

## META ADS (Facebook / Instagram)

### Quiz Rápido (`/rapido/`)

**Genérico:**
```
https://diagnostico.hospitalcapilar.com/rapido/?utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-general&utm_content={{ad.name}}
```

**Jóvenes (El Espejo):**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=jovenes&utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-jovenes&utm_content={{ad.name}}
```

**Mujeres (Es Normal):**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=mujeres&utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-mujeres&utm_content={{ad.name}}
```

**Postparto (Lo Que Vino Con el Bebé):**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=postparto&utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-postparto&utm_content={{ad.name}}
```

**¿Qué Me Pasa? (Gateway):**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=que-me-pasa&utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-que-me-pasa&utm_content={{ad.name}}
```

**Segunda Opinión (Ya Me Engañaron):**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=segunda-opinion&utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-segunda-opinion&utm_content={{ad.name}}
```

**Farmacia Sin Salida (OTC Frustrado):**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=farmacia-sin-salida&utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-farmacia-sin-salida&utm_content={{ad.name}}
```

**Post-Trasplante (La Inversión):**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=post-trasplante&utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-post-trasplante&utm_content={{ad.name}}
```

---

### Formulario Directo (`/form/`)

**Genérico:**
```
https://diagnostico.hospitalcapilar.com/form/?utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-general&utm_content={{ad.name}}
```

**Jóvenes:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=jovenes&utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-jovenes&utm_content={{ad.name}}
```

**Mujeres:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=mujeres&utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-mujeres&utm_content={{ad.name}}
```

**Postparto:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=postparto&utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-postparto&utm_content={{ad.name}}
```

**¿Qué Me Pasa?:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=que-me-pasa&utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-que-me-pasa&utm_content={{ad.name}}
```

**Segunda Opinión:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=segunda-opinion&utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-segunda-opinion&utm_content={{ad.name}}
```

**Farmacia Sin Salida:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=farmacia-sin-salida&utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-farmacia-sin-salida&utm_content={{ad.name}}
```

**Post-Trasplante:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=post-trasplante&utm_source=facebook&utm_medium=paid_social&utm_campaign=form-directo-post-trasplante&utm_content={{ad.name}}
```

---

### Quiz Largo (`/`)

```
https://diagnostico.hospitalcapilar.com/?utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-largo-general&utm_content={{ad.name}}
```

---

## GOOGLE ADS (Search)

### Quiz Rápido (`/rapido/`)

**Genérico:**
```
https://diagnostico.hospitalcapilar.com/rapido/?utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-general&utm_content={adgroupid}&utm_term={keyword}
```

**Jóvenes:**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=jovenes&utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-jovenes&utm_content={adgroupid}&utm_term={keyword}
```

**Mujeres:**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=mujeres&utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-mujeres&utm_content={adgroupid}&utm_term={keyword}
```

**Postparto:**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=postparto&utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-postparto&utm_content={adgroupid}&utm_term={keyword}
```

**¿Qué Me Pasa?:**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=que-me-pasa&utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-que-me-pasa&utm_content={adgroupid}&utm_term={keyword}
```

**Segunda Opinión:**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=segunda-opinion&utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-segunda-opinion&utm_content={adgroupid}&utm_term={keyword}
```

**Farmacia Sin Salida:**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=farmacia-sin-salida&utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-farmacia-sin-salida&utm_content={adgroupid}&utm_term={keyword}
```

**Post-Trasplante:**
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho=post-trasplante&utm_source=google&utm_medium=cpc&utm_campaign=quiz-rapido-post-trasplante&utm_content={adgroupid}&utm_term={keyword}
```

---

### Formulario Directo (`/form/`)

**Genérico:**
```
https://diagnostico.hospitalcapilar.com/form/?utm_source=google&utm_medium=cpc&utm_campaign=form-directo-general&utm_content={adgroupid}&utm_term={keyword}
```

**Jóvenes:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=jovenes&utm_source=google&utm_medium=cpc&utm_campaign=form-directo-jovenes&utm_content={adgroupid}&utm_term={keyword}
```

**Mujeres:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=mujeres&utm_source=google&utm_medium=cpc&utm_campaign=form-directo-mujeres&utm_content={adgroupid}&utm_term={keyword}
```

**Postparto:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=postparto&utm_source=google&utm_medium=cpc&utm_campaign=form-directo-postparto&utm_content={adgroupid}&utm_term={keyword}
```

**¿Qué Me Pasa?:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=que-me-pasa&utm_source=google&utm_medium=cpc&utm_campaign=form-directo-que-me-pasa&utm_content={adgroupid}&utm_term={keyword}
```

**Segunda Opinión:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=segunda-opinion&utm_source=google&utm_medium=cpc&utm_campaign=form-directo-segunda-opinion&utm_content={adgroupid}&utm_term={keyword}
```

**Farmacia Sin Salida:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=farmacia-sin-salida&utm_source=google&utm_medium=cpc&utm_campaign=form-directo-farmacia-sin-salida&utm_content={adgroupid}&utm_term={keyword}
```

**Post-Trasplante:**
```
https://diagnostico.hospitalcapilar.com/form/?nicho=post-trasplante&utm_source=google&utm_medium=cpc&utm_campaign=form-directo-post-trasplante&utm_content={adgroupid}&utm_term={keyword}
```

---

### Quiz Largo (`/`)

```
https://diagnostico.hospitalcapilar.com/?utm_source=google&utm_medium=cpc&utm_campaign=quiz-largo-general&utm_content={adgroupid}&utm_term={keyword}
```

---

## Google Display / YouTube

Usar `utm_medium=display` o `utm_medium=video`:

```
https://diagnostico.hospitalcapilar.com/rapido/?nicho={slug}&utm_source=google&utm_medium=display&utm_campaign=display-{nicho}&utm_content={adgroupid}
```
```
https://diagnostico.hospitalcapilar.com/rapido/?nicho={slug}&utm_source=google&utm_medium=video&utm_campaign=youtube-{nicho}&utm_content={adgroupid}
```

---

## Variables dinámicas

### Meta Ads (campo URL Parameters del Ad)
| Variable | Qué captura |
|---|---|
| `{{ad.name}}` | Nombre del anuncio |
| `{{adset.name}}` | Nombre del ad set |
| `{{campaign.name}}` | Nombre de la campaña |

### Google Ads (ValueTrack parameters)
| Variable | Qué captura |
|---|---|
| `{keyword}` | Keyword que activó el anuncio |
| `{adgroupid}` | ID del grupo de anuncios |
| `{campaignid}` | ID de la campaña |
| `{creative}` | ID de la creatividad |
| `{matchtype}` | Tipo de concordancia (e, p, b) |
| `{network}` | Red (g=search, d=display) |
| `{device}` | Dispositivo (m, t, c) |

---

## Configuración rápida

### En Meta Ads Manager
En cada anuncio → **Tracking → URL Parameters**:
```
utm_source=facebook&utm_medium=paid_social&utm_campaign=quiz-rapido-{nicho}&utm_content={{ad.name}}
```

### En Google Ads
**Campaign Settings → Campaign URL options → Tracking template**:
```
{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={_campaign}&utm_content={adgroupid}&utm_term={keyword}
```

---

## Dónde se almacenan

| Destino | Campos |
|---|---|
| **GHL** | Custom fields: utm_source, utm_medium, utm_campaign, utm_content, utm_term |
| **Salesforce** | Web-to-Lead: utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, referrer, landing_url |
| **Firebase** | `quiz_leads.source.{channel, utm_source, utm_medium, utm_campaign, fbclid, gclid, referrer, landing_url, door}` |
| **PostHog** | Event properties en `quiz_started` |
