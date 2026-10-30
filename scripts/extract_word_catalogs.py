#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/extract_word_catalogs.py
Pipeline Industrial de Engenharia Reversa dos 6 Catálogos Word (.doc/.docx)
de Interruptores, Comutadores, Botões e Capas Automotivas.

1. Conversão automática .doc -> .docx via Word COM / LibreOffice em cache temp (scripts/.converted_docx/).
2. Parsing de tabelas de 6 colunas (Slots Esquerdo e Direito) e seções de catálogo.
3. Extração e conversão de imagens para Studio WebP (Pillow / EMF / webp_studio_converter.py).
4. Higienização e indexação de códigos principais, conversões cruzadas, códigos curtos, OEMs e caixas.
5. Emissão de `src/data/catalog-master-seed.json` com integridade 100%.
"""

from __future__ import annotations

import io
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Import webp_studio_converter
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from webp_studio_converter import convert_bytes_to_studio_webp
import docx
from PIL import Image

CONVERTED_DOCX_DIR = SCRIPT_DIR / ".converted_docx"
IMAGES_OUT_DIR = PROJECT_ROOT / "public" / "catalog-images" / "interruptores"
OUTPUT_SEED_JSON = PROJECT_ROOT / "src" / "data" / "catalog-master-seed.json"

DOC_FILES_INFO = [
    {
        "pattern": "*CAPAS DE INTERRUPTORES*",
        "category_default": "Capas e Botões",
        "doc_title": "Capas de Interruptores de Farol, Ignição e Ar"
    },
    {
        "pattern": "*INTERRUPTOR DE ALERTA*",
        "category_default": "Interruptor de Alerta",
        "doc_title": "Interruptores e Botões de Alerta"
    },
    {
        "pattern": "*INTERRUPTOR DE FAROL E COMUTADOR*",
        "category_default": "Interruptor de Farol",
        "doc_title": "Interruptor de Farol e Comutador de Farol"
    },
    {
        "pattern": "*INTERRUPTOR DE PORTA*",
        "category_default": "Interruptor de Porta",
        "doc_title": "Interruptor de Porta e Freio de Mão"
    },
    {
        "pattern": "*INTERRUPTOR FAROL DE MILHA*",
        "category_default": "Farol de Milha / Auxiliar",
        "doc_title": "Botão Farol de Milha (Auxiliar)"
    },
    {
        "pattern": "*INTERRUPTORES DIVERSOS*",
        "category_default": "Interruptores Diversos",
        "doc_title": "Interruptores Diversos (Vidro, Ventilador, Tic-Tac, Trava)"
    }
]

def ensure_converted_docx(doc_path: Path) -> Path:
    """Garante a existência do arquivo .docx convertido e atualizado."""
    CONVERTED_DOCX_DIR.mkdir(parents=True, exist_ok=True)
    out_docx = CONVERTED_DOCX_DIR / f"{doc_path.stem}.docx"
    
    # Se já existe e é mais novo que o doc original
    if out_docx.exists() and out_docx.stat().st_mtime >= doc_path.stat().st_mtime:
        return out_docx
        
    print(f"[Word COM] Convertendo {doc_path.name} -> {out_docx.name}...")
    try:
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False
        try:
            doc = word.Documents.Open(str(doc_path.resolve()), ReadOnly=True)
            doc.SaveAs2(str(out_docx.resolve()), FileFormat=16)  # 16 = wdFormatXMLDocument
            doc.Close(False)
        finally:
            word.Quit()
        print(f"  OK: Convertido com sucesso via Microsoft Word COM.")
        return out_docx
    except Exception as e_word:
        print(f"  Falha no Word COM: {e_word}. Tentando LibreOffice fallback...")
        try:
            subprocess.run(
                ["soffice", "--headless", "--convert-to", "docx", str(doc_path.resolve()), "--outdir", str(CONVERTED_DOCX_DIR.resolve())],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            return out_docx
        except Exception as e_soffice:
            raise RuntimeError(f"Não foi possível converter {doc_path.name}: Word COM ({e_word}), LibreOffice ({e_soffice})")

def extract_image_bytes_from_cell(cell: Any, doc: Any, zip_archive: zipfile.ZipFile) -> List[Tuple[str, bytes]]:
    """Extrai todas as imagens vinculadas a uma célula do Word."""
    xml = cell._tc.xml
    rids = re.findall(r'r:embed="([^"]+)"', xml) + re.findall(r'r:id="([^"]+)"', xml)
    found_images = []
    
    for rid in rids:
        if rid in doc.part.rels:
            rel = doc.part.rels[rid]
            target = rel.target_ref
            # Somente extensões de imagem conhecidas
            if not any(target.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".emf", ".gif", ".bmp", ".wmf"]):
                continue
            # Normalizar caminho dentro do zip
            target_norm = target.replace("\\", "/").lstrip("/")
            if not target_norm.startswith("word/"):
                zip_path = f"word/{target_norm}"
            else:
                zip_path = target_norm
                
            if zip_path in zip_archive.namelist():
                try:
                    data = zip_archive.read(zip_path)
                    found_images.append((zip_path, data))
                except Exception as e:
                    print(f"  Erro ao ler imagem {zip_path}: {e}")
    return found_images

def convert_raw_image_to_studio_webp(raw_bytes: bytes, file_name_hint: str, output_path: Path) -> Optional[str]:
    """Converte bytes brutos (PNG, JPEG, GIF, EMF) para Studio WebP com fundo branco puro."""
    # Se for EMF, carrega via Pillow
    ext = Path(file_name_hint).suffix.lower()
    img_bytes_to_use = raw_bytes
    
    if ext == ".emf" or raw_bytes.startswith(b"\x01\x00\x00\x00"):
        try:
            im = Image.open(io.BytesIO(raw_bytes))
            im.load()
            buf = io.BytesIO()
            im.convert("RGBA").save(buf, format="PNG")
            img_bytes_to_use = buf.getvalue()
        except Exception as e:
            print(f"  Aviso: Não foi possível carregar EMF {file_name_hint} diretamente: {e}")
            
    res = convert_bytes_to_studio_webp(
        raw_image_bytes=img_bytes_to_use,
        output_path=output_path,
        max_dimension=1600,
        quality=96,
        padding=16,
        clean_corners=True,
    )
    
    if res.success and res.output_path:
        return f"/catalog-images/interruptores/{output_path.name.lower()}"
    else:
        print(f"  Falha ao converter WebP: {res.audit_message}")
        return None

def normalize_code_key(code: str) -> str:
    """Remove pontuação e espaços para chave de busca/comparação."""
    return re.sub(r"[^a-zA-Z0-9]", "", code).lower()

def clean_hyphens(text: str) -> str:
    """'ECH - 7425' -> 'ECH-7425', 'IM - 11177' -> 'IM-11177', 'DP - 3042' -> 'DP-3042'."""
    text = re.sub(r"\s*[-–—]\s*", "-", text)
    text = re.sub(r"\s*\.\s*", ".", text)
    return text.strip()

def parse_box_cell(box_text: str) -> Tuple[str, str, str]:
    """Retorna (boxNumber, internalCode, boxDisplay)."""
    if not box_text:
        return "", "", "S/CX"
    lines = [ln.strip() for ln in box_text.split("\n") if ln.strip()]
    if not lines:
        return "", "", "S/CX"
        
    line0 = lines[0].replace("CX.", "").replace("CX", "").replace("Caixa", "").strip()
    line1 = lines[1].strip() if len(lines) > 1 else ""
    
    box_num = line0
    internal = line1
    
    # Se a linha 0 tem formato '06' e linha 1 'BO6'
    if not internal and "BO" in box_num:
        internal = box_num
        box_num = re.sub(r"[^0-9]", "", box_num)
        
    if not box_num and internal:
        box_num = re.sub(r"[^0-9]", "", internal)
        
    display = f"CAIXA {box_num}" if box_num else ("CAIXA " + internal if internal else "S/CX")
    return box_num, internal, display

KNOWN_VEHICLES = [
    "Gol", "Voyage", "Parati", "Saveiro", "Santana", "Quantum", "Passat", "Fusca", "Brasília", 
    "Variant", "Kombi", "Fox", "CrossFox", "SpaceFox", "Polo", "Golf", "Bora", "Corsa", "Celta", 
    "Prisma", "Monza", "Kadett", "Opala", "Caravan", "Chevette", "Vectra", "Astra", "Zafira", 
    "Onix", "Cobalt", "Uno", "Palio", "Siena", "Strada", "Fiorino", "Prêmio", "Elba", "Tempra", 
    "Marea", "Brava", "Escort", "Verona", "Apollo", "Logus", "Pointer", "Fiesta", "Ka", "Courier", 
    "Corcel", "Belina", "Del Rey", "Pampa", "Clio", "HB20", "Mercedes"
]

def extract_vehicles_and_makes(text: str) -> Tuple[List[str], List[str]]:
    vehicles = []
    makes = set()
    for v in KNOWN_VEHICLES:
        if re.search(r"\b" + re.escape(v) + r"\b", text, re.IGNORECASE):
            vehicles.append(v)
            if v in ["Gol", "Voyage", "Parati", "Saveiro", "Santana", "Quantum", "Passat", "Fusca", "Brasília", "Variant", "Kombi", "Fox", "CrossFox", "SpaceFox", "Polo", "Golf", "Bora", "Apollo", "Logus", "Pointer"]:
                makes.add("VW")
            elif v in ["Corsa", "Celta", "Prisma", "Monza", "Kadett", "Opala", "Caravan", "Chevette", "Vectra", "Astra", "Zafira", "Onix", "Cobalt"]:
                makes.add("GM / Chevrolet")
            elif v in ["Uno", "Palio", "Siena", "Strada", "Fiorino", "Prêmio", "Elba", "Tempra", "Marea", "Brava"]:
                makes.add("Fiat")
            elif v in ["Escort", "Verona", "Fiesta", "Ka", "Courier", "Corcel", "Belina", "Del Rey", "Pampa"]:
                makes.add("Ford")
            elif v in ["Clio"]:
                makes.add("Renault")
            elif v in ["HB20"]:
                makes.add("Hyundai")
            elif v in ["Mercedes"]:
                makes.add("Mercedes")
                
    if re.search(r"\bvw\b|volks", text, re.I):
        makes.add("VW")
    if re.search(r"\bgm\b|chevrolet", text, re.I):
        makes.add("GM / Chevrolet")
    if re.search(r"\bfiat\b", text, re.I):
        makes.add("Fiat")
    if re.search(r"\bford\b", text, re.I):
        makes.add("Ford")
    if re.search(r"\buniversal\b|adapta[cç][aã]o|adptacao", text, re.I):
        makes.add("Universal / Adaptação")
        
    return vehicles, sorted(list(makes))

def extract_technical_specs(text: str) -> List[str]:
    specs = []
    if re.search(r"1\s*est[aá]gio", text, re.I):
        specs.append("1 Estágio")
    if re.search(r"2\s*est[aá]gio", text, re.I):
        specs.append("2 Estágios")
    if re.search(r"3\s*pino", text, re.I):
        specs.append("3 Pinos")
    if re.search(r"4\s*pino", text, re.I):
        specs.append("4 Pinos")
    if re.search(r"c/\s*led|com\s*led|led\s+[a-z]+", text, re.I):
        specs.append("Com LED")
    if re.search(r"regul[aá]vel", text, re.I):
        specs.append("Regulável")
    if re.search(r"com suporte|c/\s*suporte", text, re.I):
        specs.append("Com Suporte")
    if re.search(r"\blongo\b", text, re.I):
        specs.append("Longo")
    if re.search(r"\bcurto\b", text, re.I):
        specs.append("Curto")
    if re.search(r"redondo", text, re.I):
        specs.append("Redondo")
    if re.search(r"quadrado", text, re.I):
        specs.append("Quadrado")
    if re.search(r"tic-?tac", text, re.I):
        specs.append("Tic-Tac")
    if re.search(r"puxar", text, re.I):
        specs.append("Interruptor de Puxar")
    if re.search(r"pedal", text, re.I):
        specs.append("Interruptor de Pedal")
    if re.search(r"universal|adptacao|adapta[cç][aã]o", text, re.I):
        specs.append("Universal")
    if re.search(r"bucha longa", text, re.I):
        specs.append("Bucha Longa")
    if re.search(r"tecl[aã]o|tecla grande", text, re.I):
        specs.append("Tecla Grande (Teclão)")
    if re.search(r"desemba[cç]ador", text, re.I):
        specs.append("Desembaçador")
    if re.search(r"ventilador", text, re.I):
        specs.append("Ventilador")
    if re.search(r"ar condicionado", text, re.I):
        specs.append("Ar Condicionado")
    if re.search(r"trava el[eé]trica", text, re.I):
        specs.append("Trava Elétrica")
    return specs

def detect_part_brand(code: str, text: str) -> str:
    c = code.upper()
    t = text.upper()
    if c.startswith("DP-") or c.startswith("DP ") or "DPAULA" in t:
        return "D'Paula"
    if c.startswith("IM-") or c.startswith("IM ") or c.startswith("IM") or "MARILIA" in t:
        return "Marília"
    if c.startswith("K") or "KOSTAL" in t:
        return "Kostal"
    if "DNI" in c or "DNI" in t:
        return "DNI"
    if "ECH" in c or "ECHLIN" in t:
        return "Echlin"
    if "DTC" in c or "DIRETEC" in t:
        return "DTC / Diretec"
    if "UNM" in c or "UNIFAP" in t:
        return "Unifap"
    if "TRW" in c:
        return "TRW"
    if c.startswith("GM"):
        return "GM / Original"
    if c.startswith("FD"):
        return "Ford / Original"
    if c.startswith("AP"):
        return "Auto Peças"
    if c.startswith("WF"):
        return "WF"
    if c.startswith("EP"):
        return "EP"
    return "Universal / Padrão"

def parse_slot_data(
    desc_raw: str,
    box_raw: str,
    section_name: str,
    category_default: str,
    doc_stem: str,
    slot_index: int
) -> Dict[str, Any]:
    """Interpreta os dados de um slot de produto com alta precisão."""
    lines = [clean_hyphens(ln.strip()) for ln in desc_raw.split("\n") if ln.strip()]
    box_num, internal_code, box_display = parse_box_cell(box_raw)
    
    commercial_code = ""
    cross_codes: List[str] = []
    oem_codes: List[str] = []
    description_lines: List[str] = []
    
    # Se não tem linhas de texto
    if not lines:
        commercial_code = f"VISUAL-CX{box_num or slot_index:02d}"
        description = f"[Identificação Visual] {section_name} — {box_display}"
        needs_review = True
    else:
        # Padrão: 1ª linha costuma ser o código principal quando é código
        first_line = lines[0]
        # Casos especiais conhecidos
        prefix_code_match = re.match(
            r"^((?:DP|IM|IK|DTC|ECH|GM|FD|UNM|WF|EP|DB|BAF|BAG|AP|CL|K|R|TRW|Ec|DNI)[-–—\s\.]*[0-9]{1,8}(?:\.[0-9]{1,4})?(?:-[0-9A-Za-z]+)?)\b(?:\s*[-–—:]\s*|\s+)(.*)$",
            first_line,
            re.IGNORECASE
        )
        if prefix_code_match and not re.search(r"^(ar|capa|bot[aã]o|interruptor|regulagem|ventila|acabamento|moldura)", first_line, re.I):
            commercial_code = clean_hyphens(prefix_code_match.group(1))
            remaining_text = prefix_code_match.group(2).strip()
            description_lines = ([remaining_text] if remaining_text else []) + lines[1:]
        elif "Universal (Regulável) com suporte" in first_line:
            commercial_code = "DP-7.078-SUP"
            cross_codes.append("UNIV-CX01")
            description_lines = lines
        elif first_line.startswith("INTERRUPTOR DA TRAVA"):
            commercial_code = "VW4001"
            cross_codes.extend(["OR PARTS VW4001", "377953235"])
            oem_codes.append("377953235")
            description_lines = lines
        elif first_line.startswith("INTERRUPTOR DE ALERTA GOL 88/94"):
            commercial_code = "K10012423"
            description_lines = lines
        elif first_line.startswith("INTERRUPTOR ALERTA GOL/VOYAGE GV"):
            commercial_code = "DTC2178"
            description_lines = lines
        elif first_line.startswith("BOTÃO PISCA") or first_line.startswith("BOTAO PISCA"):
            commercial_code = "IM11231"
            cross_codes.append("CORONA 8428")
            description_lines = lines
        elif re.match(r"^[A-Za-z0-9\.\-\/\s]{2,18}$", first_line) and not re.search(r"^(ar|capa|bot[aã]o|interruptor|regulagem|ventila|acabamento|moldura|universal)", first_line, re.I):
            commercial_code = clean_hyphens(first_line)
            description_lines = lines[1:]
        else:
            # Tenta encontrar código na última linha ou nas linhas seguintes
            code_found = None
            for idx, ln in enumerate(lines):
                # Se for código como WF-66015, EP-40572-0, DB037D, BAF060, AP-106, 9348, CL033, etc.
                if re.match(r"^[A-Z]{1,4}\s*[-–—]?\s*[0-9]{3,8}(?:-[A-Za-z0-9]+)?$", ln, re.I) or re.match(r"^[0-9]{4,8}$", ln):
                    code_found = clean_hyphens(ln)
                    description_lines = [l for i, l in enumerate(lines) if i != idx]
                    break
            if code_found:
                commercial_code = code_found
            else:
                # Gera código baseado no nome da peça e caixa
                prefix = re.sub(r"[^A-Za-z]", "", first_line[:6]).upper() or "INT"
                box_token = box_num or internal_code or str(slot_index)
                commercial_code = f"{prefix}-{box_token}"
                description_lines = lines
                
    # Detectar códigos adicionais no corpo (conversões e OEM)
    full_text = " ".join(lines)
    
    # Busca por 'Nº. ORIG:', 'ORIG:', 'VW:', etc.
    oem_matches = re.findall(r"(?:orig(?:inal)?|vw|n[ºo]\.?\s*orig[:\s]*)\s*[:\s]*([0-9A-Za-z\.\-\/]+)", full_text, re.I)
    for m in oem_matches:
        cleaned_m = clean_hyphens(m.strip(".,;:"))
        if cleaned_m and cleaned_m not in oem_codes:
            oem_codes.append(cleaned_m)
            
    # Procura códigos conhecidos de OEM como 542.947.561-A, 75.273.790, 90.087.763, 113.947.561-2, 307.941.535.1, ZBC.941.535, 321.941.535.B, 377.943.561, 4.102.793, 8.940.745, 57.714, 94.611.136, 2.886.712
    part_number_matches = re.findall(r"\b([0-9]{1,3}\.[0-9]{3}\.[0-9]{3}(?:-[0-9A-Za-z]+)?)\b", full_text)
    for m in part_number_matches:
        if m not in oem_codes:
            oem_codes.append(m)
            
    zbc_matches = re.findall(r"\b(ZBC\.[0-9\.]+)\b", full_text, re.I)
    for m in zbc_matches:
        if m not in oem_codes:
            oem_codes.append(m)
            
    # Procura códigos curtos de 4 dígitos como 9336, 9341, 9343, 9344, 9346, 9334, 9332, 9335, 9333, 9337, 9339, 9331, 9348, 9349, 9350, 9347, 9351
    short_code_matches = re.findall(r"\b(93[345][0-9])\b", full_text)
    for m in short_code_matches:
        if m not in cross_codes and m != commercial_code:
            cross_codes.append(m)
            
    # Procura referências cruzadas IM-..., K..., DTC..., DNI...
    cross_brand_matches = re.findall(r"\b((?:IM|K|DTC|DNI|ECH|OP)[-–—\s]?[0-9]{4,8}[A-Za-z0-9]*)\b", full_text, re.I)
    for m in cross_brand_matches:
        cleaned_cb = clean_hyphens(m)
        if cleaned_cb != commercial_code and cleaned_cb not in cross_codes:
            cross_codes.append(cleaned_cb)
            
    description = " ".join(description_lines).strip()
    if not description:
        description = desc_raw.replace("\n", " ").strip()
        
    vehicles, makes = extract_vehicles_and_makes(full_text)
    specs = extract_technical_specs(full_text)
    part_brand = detect_part_brand(commercial_code, full_text)
    
    # Search tokens
    search_tokens = set()
    for tok in [commercial_code, box_num, internal_code, box_display]:
        if tok:
            search_tokens.add(tok.lower())
            search_tokens.add(normalize_code_key(tok))
    if box_num:
        search_tokens.add(f"cx{box_num.lower()}")
        search_tokens.add(f"cx {box_num.lower()}")
        search_tokens.add(f"caixa {box_num.lower()}")
        search_tokens.add(f"caixa{box_num.lower()}")
        # versão sem zero à esquerda
        no_zero = box_num.lstrip("0")
        if no_zero:
            search_tokens.add(no_zero.lower())
            search_tokens.add(f"cx {no_zero.lower()}")
            search_tokens.add(f"caixa {no_zero.lower()}")
            
    for c in cross_codes:
        search_tokens.add(c.lower())
        search_tokens.add(normalize_code_key(c))
    for o in oem_codes:
        search_tokens.add(o.lower())
        search_tokens.add(normalize_code_key(o))
    for v in vehicles:
        search_tokens.add(v.lower())
    for m in makes:
        search_tokens.add(m.lower())
    for s in specs:
        search_tokens.add(s.lower())
    for w in re.findall(r"[A-Za-z0-9]+", full_text.lower()):
        if len(w) >= 2:
            search_tokens.add(w)
            
    return {
        "commercialCode": commercial_code,
        "commercialCodeRaw": lines[0] if lines else commercial_code,
        "boxNumber": box_num,
        "internalCode": internal_code,
        "boxDisplay": box_display,
        "description": description,
        "rawText": desc_raw,
        "specs": specs,
        "vehicles": vehicles,
        "manufacturers": makes,
        "partBrand": part_brand,
        "crossReferenceCodes": cross_codes,
        "oemCodes": oem_codes,
        "searchTokens": sorted(list(search_tokens)),
        "needsDescriptionReview": not bool(lines)
    }

def process_all_catalogs() -> List[Dict[str, Any]]:
    CONVERTED_DOCX_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Localizar todos os 6 documentos na raiz
    all_docs = list(PROJECT_ROOT.glob("*.doc")) + list(PROJECT_ROOT.glob("*.docx"))
    doc_paths = []
    for info in DOC_FILES_INFO:
        matched = [d for d in all_docs if any(Path(p).match(info["pattern"]) for p in [d.name])]
        if matched:
            doc_paths.append((matched[0], info))
            
    print(f"Total de documentos identificados para extração: {len(doc_paths)}")
    
    products: List[Dict[str, Any]] = []
    global_index = 0
    stats_by_doc: Dict[str, Dict[str, int]] = {}
    
    for doc_path, info in doc_paths:
        docx_path = ensure_converted_docx(doc_path)
        doc = docx.Document(str(docx_path))
        
        with zipfile.ZipFile(str(docx_path), "r") as zip_arch:
            doc_products_count = 0
            doc_images_count = 0
            stats_by_doc[doc_path.name] = {"products": 0, "images": 0}
            
            # Identificar títulos de seções no documento
            body_paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            
            for t_idx, table in enumerate(doc.tables):
                # Seção associada à tabela
                if "CAPAS DE INTERRUPTORES" in doc_path.name:
                    if t_idx == 0:
                        section_name = "Capas e Botões de Ar / Farol / Retrovisor"
                        category = "Capas e Botões"
                    elif t_idx == 1:
                        section_name = "Botão Falso de Painel"
                        category = "Botão Falso"
                    else:
                        section_name = "Moldura de Interruptor"
                        category = "Moldura de Interruptor"
                elif "INTERRUPTOR DE ALERTA" in doc_path.name:
                    section_name = "Interruptores e Botões de Alerta"
                    category = "Interruptor de Alerta"
                elif "INTERRUPTOR DE FAROL E COMUTADOR" in doc_path.name:
                    if t_idx == 0:
                        section_name = "Interruptor de Farol"
                        category = "Interruptor de Farol"
                    else:
                        section_name = "Comutador de Alto e Baixo do Farol"
                        category = "Comutador de Farol"
                elif "INTERRUPTOR DE PORTA" in doc_path.name:
                    if t_idx == 0:
                        section_name = "Interruptor de Porta"
                        category = "Interruptor de Porta"
                    else:
                        section_name = "Interruptor de Freio de Mão"
                        category = "Interruptor de Freio de Mão"
                elif "INTERRUPTOR FAROL DE MILHA" in doc_path.name:
                    section_name = "Botão Farol de Milha (Auxiliar)"
                    category = "Farol de Milha / Auxiliar"
                elif "INTERRUPTORES DIVERSOS" in doc_path.name:
                    section_name = "Interruptores Diversos (Vidro, Ventilador, Tic-Tac, Trava)"
                    category = "Interruptores Diversos"
                else:
                    section_name = info["doc_title"]
                    category = info["category_default"]
                    
                for r_idx, row in enumerate(table.rows):
                    if r_idx == 0:
                        # Cabeçalho da tabela
                        continue
                        
                    cells = row.cells
                    if len(cells) < 6:
                        continue
                        
                    # 2 slots por linha (Esquerdo: 0,1,2 / Direito: 3,4,5)
                    slots = [
                        ("left", cells[0], cells[1], cells[2]),
                        ("right", cells[3], cells[4], cells[5])
                    ]
                    
                    for slot_side, img_cell, desc_cell, box_cell in slots:
                        desc_text = desc_cell.text.strip()
                        box_text = box_cell.text.strip()
                        raw_images = extract_image_bytes_from_cell(img_cell, doc, zip_arch)
                        
                        # Se não há descrição, caixa e nem imagem, é célula vazia de alinhamento
                        if not desc_text and not box_text and not raw_images:
                            continue
                            
                        global_index += 1
                        doc_products_count += 1
                        
                        parsed = parse_slot_data(
                            desc_raw=desc_text,
                            box_raw=box_text,
                            section_name=section_name,
                            category_default=category,
                            doc_stem=doc_path.stem,
                            slot_index=global_index
                        )
                        
                        # Slug único e limpo 100% lowercase
                        code_slug = re.sub(r"[^a-z0-9]+", "-", parsed["commercialCode"].lower()).strip("-")
                        box_slug = re.sub(r"[^a-z0-9]+", "-", (parsed["boxNumber"] or parsed["internalCode"] or "scx").lower()).strip("-")
                        doc_code = re.sub(r"[^a-z0-9]+", "-", doc_path.stem.lower()).strip("-")[:12]
                        
                        unique_id = f"{doc_code}-{code_slug}-cx{box_slug}-{global_index}"
                        
                        # Processar imagens para WebP Studio
                        processed_images: List[str] = []
                        for img_idx, (zip_path, raw_bytes) in enumerate(raw_images):
                            img_file_name = f"{unique_id}_{img_idx+1}.webp".lower()
                            out_img_path = IMAGES_OUT_DIR / img_file_name
                            webp_url = convert_raw_image_to_studio_webp(raw_bytes, zip_path, out_img_path)
                            if webp_url:
                                processed_images.append(webp_url)
                                doc_images_count += 1
                                
                        # Montar objeto de produto final
                        prod_item = {
                            "id": unique_id,
                            "category": category,
                            "section": section_name,
                            "sourceDocument": doc_path.name,
                            "boxNumber": parsed["boxNumber"],
                            "boxDisplay": parsed["boxDisplay"],
                            "internalCode": parsed["internalCode"],
                            "commercialCode": parsed["commercialCode"],
                            "commercialCodeRaw": parsed["commercialCodeRaw"],
                            "description": parsed["description"],
                            "specs": parsed["specs"],
                            "vehicles": parsed["vehicles"],
                            "manufacturers": parsed["manufacturers"],
                            "partBrand": parsed["partBrand"],
                            "crossReferenceCodes": parsed["crossReferenceCodes"],
                            "oemCodes": parsed["oemCodes"],
                            "searchTokens": parsed["searchTokens"],
                            "images": processed_images,
                            "price": None,
                            "isCustom": False,
                            "needsDescriptionReview": parsed["needsDescriptionReview"],
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                        products.append(prod_item)
                        
            stats_by_doc[doc_path.name]["products"] = doc_products_count
            stats_by_doc[doc_path.name]["images"] = doc_images_count
            print(f"[{doc_path.name}] Extraídos {doc_products_count} produtos e {doc_images_count} fotos WebP.")

    # Salvar catalog-master-seed.json
    OUTPUT_SEED_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_SEED_JSON.write_text(
        json.dumps(products, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"\n=======================================================")
    print(f"Sucesso Total: {len(products)} produtos gravados em {OUTPUT_SEED_JSON.name}!")
    for doc_name, stat in stats_by_doc.items():
        print(f"  * {doc_name}: {stat['products']} produtos, {stat['images']} fotos")
    print(f"=======================================================")
    return products

if __name__ == "__main__":
    process_all_catalogs()
