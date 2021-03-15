function insertAtCursor(myField,myValue){if(document.selection){myField.focus();sel=document.selection.createRange();sel.text=myValue;}else if(myField.selectionStart||myField.selectionStart=='0'){var startPos=myField.selectionStart;var endPos=myField.selectionEnd;restoreTop=myField.scrollTop;myField.value=myField.value.substring(0,startPos)+myValue+myField.value.substring(endPos,myField.value.length);myField.selectionStart=startPos+myValue.length;myField.selectionEnd=startPos+myValue.length;if(restoreTop>0){myField.scrollTop=restoreTop;}}else{myField.value+=myValue;}}function interceptTabs(evt,control){key=evt.keyCode?evt.keyCode:evt.which?evt.which:evt.charCode;if(key==9){insertAtCursor(control,'\t');return false;}else{return key;}}
(function(){var Heap=function(){var heapSpace={};return{store:function(addr,val){if(typeof addr=="undefined"||typeof val=="undefined"){throw"Heap store invoked with undefined address or value";}heapSpace[addr]=val;return val;},retrieve:function(addr){var val=heapSpace[addr];if(typeof val=="undefined"){return this.store(addr,0);}return val;},toArray:function(){return heapSpace;}}};var sourceTokens={' ':true,'\n':true,'\t':true};var isSource=function(token){return sourceTokens[token];};var parseParam=function(tokenizer){var sign=0;var value=0;var paramStr='';while(tokenizer.hasNext()){var token=tokenizer.getNext();if(!isSource(token))continue;paramStr+=token;if(token=='\n')break;if(!sign){sign={' ':1,'\t':-1}[token];}else{value=(value<<1)+{' ':0,'\t':1}[token];}}return{token:paramStr,value:sign*value};};var replaceLabelWS=function(label){return label.replace(/ /g,'s').replace(/\t/g,'t');};var asmObject=function(labels,mnemo,paramVal,paramLabel){var replaceLabels=[];for(var i in labels){replaceLabels.push(labels[i]);}return{labels:replaceLabels,mnemo:mnemo,param:{val:paramVal,label:paramLabel}};};var asmWithValueParam=function(){return asmObject(this.labels,this.mnemoCode,this.param.value,null);};var asmWithLabelParam=function(){return asmObject(this.labels,this.mnemoCode,null,this.param.token);};var asmWithNoParam=function(){return asmObject(this.labels,this.mnemoCode,null);};ws={env:function(){var self={register:{IP:0,SP:0},stack:[],heap:new Heap(),callStack:[],running:false,paused:true,runProgram:function(program){try{this.running=true;this.paused=false;while(this.running&&this.register.IP<program.programStack.length){var callable=program.programStack[this.register.IP];this.beforeInstructionRun(this);callable.run(this);this.afterInstructionRun(this);}(new ws.WsEndProgram).run(this);}catch(err){if(err=="Break"){this.paused=true;}else{throw err;}}},stackPush:function(val){this.stack[this.register.SP++]=val;},stackPop:function(){if(this.register.SP<=0){throw"Stack underflow";}return this.stack[--this.register.SP]||0;},stackPeek:function(){if(this.register.SP<=0){throw"Stack underflow";}return this.stack[this.register.SP-1]||0;},createFrame:function(){this.callStack.push(this.register.IP);},closeFrame:function(){this.register.IP=this.callStack.pop()+1;},print:function(s){console.error('Print unimplemented: '+s);},println:function(s){this.print(s+'\n');},beforeInstructionRun:function(env){},afterInstructionRun:function(env){}};return self;},compile:function(fullSource){var builder=ws.programBuilder(fullSource);var parser=instParser;var tokenizer=new ws_util.StrArr(fullSource);var debugToken='';while(tokenizer.hasNext()){var token=tokenizer.getNext();if(!sourceTokens[token]){continue;}debugToken+={' ':'s','\t':'t','\n':'n'}[token];parser=parser.cont[token];if(!parser){throw{program:builder.postProcess(),message:'Unexpected token at line '+tokenizer.line+':'+tokenizer.col+' - '+debugToken}}if(parser.instFn){var instruction=new parser.instFn();if(instruction.paramType!=null){instruction.param=parseParam(tokenizer);if(!instruction.param.token){throw{program:builder.postProcess(),message:'Unexpected EOF'};}}builder.pushInstruction(instruction);parser=instParser;debugToken='';}}if(debugToken){throw{program:builder.postProcess(),message:'Unexpected EOF'};}return builder.postProcess();},programBuilder:function(fullSource,master){var builder={};for(var key in master){builder[key]=master[key];}builder.source=fullSource;builder.programStack=[];builder.labels={};builder.asmLabels=builder.asmLabels||{};builder.getAsm=function(){var asm=[];for(var i in this.programStack){var inst=this.programStack[i];asm.push(inst.getAsm());}return asm;};builder.pushInstruction=function(instruction){if(instruction.apply){instruction.apply(this);}else{instruction.address=this.programStack.length;this.programStack.push(instruction);}for(var l in instruction.labels){this.labels[instruction.labels[l]]=instruction.address;}};builder.postProcess=function(){for(var i in this.programStack){if(this.programStack[i].postProcess){this.programStack[i].postProcess(this);}}for(label in this.labels){var inst=this.programStack[this.labels[label]];if(inst){if(!inst.labels)inst.labels=[];if($.inArray(label,inst.labels)<0){inst.labels.push(label);}}else{var labelInst=new ws.WsLabel();labelInst.address=this.programStack.length;labelInst.param={token:label};this.programStack.push(labelInst);}}return this;};builder.getAsmSrc=function(){var src=[];var asm=this.getAsm();var labler=new ws_util.labelTransformer(function(n,label){return"label_"+n;});for(var i in asm){var ln=asm[i];var labels="";for(l in ln.labels){var wsLabel=ln.labels[l];var label=this.asmLabels[wsLabel]||labler.getLabel(wsLabel);labels+=(labels?"\n":"")+label+":";}if(labels){src.push({IP:null,str:labels});};var instrStr=ln.mnemo;if(ln.param.label!=null){instrStr+=" "+(this.asmLabels[ln.param.label]||labler.getLabel(ln.param.label));}if(ln.param.val!=null){instrStr+=" "+ln.param.val;}src.push({IP:i,str:instrStr});}return src;};builder.getWsSrc=function(){var src='';for(var i in this.programStack){var inst=this.programStack[i];for(l in inst.labels){src+='\n  '+inst.labels[l];}src+=inst.wsToken;var par=inst.param;if(par){src+=par.token;}};return src;};return builder;},WsPush:function(){this.run=function(env){env.stackPush(this.param.value);env.register.IP++;};this.getAsm=asmWithValueParam;},WsDouble:function(){this.run=function(env){env.stackPush(env.stackPeek());env.register.IP++;};this.getAsm=asmWithNoParam;},WsCopyNth:function(){this.run=function(env){var actualPos=env.register.SP-this.param.value-1;env.stackPush(env.stack[actualPos]);env.register.IP++;};this.getAsm=asmWithValueParam;},WsSwapTop:function(){this.run=function(env){var last=env.register.SP-1;var tmp1=env.stackPop();var tmp2=env.stackPop();env.stackPush(tmp1);env.stackPush(tmp2);env.register.IP++;};this.getAsm=asmWithNoParam;},WsDropTop:function(){this.run=function(env){env.register.SP--;env.register.IP++;};this.getAsm=asmWithNoParam;},WsSlide:function(){this.run=function(env){var top=env.stackPop();env.register.SP-=this.param.value;env.stackPush(top);env.register.IP++;};this.getAsm=asmWithValueParam;},WsAddition:function(){this.run=function(env){var b=env.stackPop();var a=env.stackPop();env.stackPush(a+b);env.register.IP++;};this.getAsm=asmWithNoParam;},WsSubtraction:function(){this.run=function(env){var b=env.stackPop();var a=env.stackPop();env.stackPush(a-b);env.register.IP++;};this.getAsm=asmWithNoParam;},WsMultiplication:function(){this.run=function(env){var b=env.stackPop();var a=env.stackPop();env.stackPush(a*b);env.register.IP++;};this.getAsm=asmWithNoParam;},WsIntDivision:function(){this.run=function(env){var b=env.stackPop();var a=env.stackPop();env.stackPush(Math.floor(a/b));env.register.IP++;};this.getAsm=asmWithNoParam;},WsModulo:function(){this.run=function(env){var b=env.stackPop();var a=env.stackPop();env.stackPush(a%b);env.register.IP++;};this.getAsm=asmWithNoParam;},WsHeapStore:function(){this.run=function(env){var value=env.stackPop();var addr=env.stackPop();env.heap.store(addr,value);env.register.IP++;};this.getAsm=asmWithNoParam;},WsHeapRetrieve:function(){this.run=function(env){var addr=env.stackPop();env.stackPush(env.heap.retrieve(addr));env.register.IP++;};this.getAsm=asmWithNoParam;},WsLabel:function(){this.apply=function(compiler){compiler.labels[this.param.token]=compiler.programStack.length;};this.getAsm=asmWithLabelParam;},WsEndProgram:function(){this.run=function(env){env.running=false;};this.getAsm=asmWithNoParam;},WsPrintNum:function(){this.run=function(env){var num=env.stackPop();env.print(num);env.register.IP++;};this.getAsm=asmWithNoParam;},WsPrintChar:function(){this.run=function(env){var ch=env.stackPop();env.print(String.fromCharCode(ch));env.register.IP++;};this.getAsm=asmWithNoParam;},WsCall:function(){this.run=function(env){env.createFrame();env.register.IP=this.callableI;};this.postProcess=function(compiler){this.callableI=compiler.labels[this.param.token];};this.getAsm=asmWithLabelParam;},WsJump:function(){this.run=function(env){env.register.IP=this.nextI;};this.postProcess=function(compiler){this.nextI=compiler.labels[this.param.token];};this.getAsm=asmWithLabelParam;},WsJumpZ:function(){this.run=function(env){var top=env.stackPop();if(top==0){env.register.IP=this.successI;}else{env.register.IP++;}};this.postProcess=function(compiler){this.successI=compiler.labels[this.param.token];};this.getAsm=asmWithLabelParam;},WsJumpNeg:function(){this.run=function(env){var top=env.stackPop();if(top<0){env.register.IP=this.successI;}else{env.register.IP++;}};this.postProcess=function(compiler){this.successI=compiler.labels[this.param.token];};this.getAsm=asmWithLabelParam;},WsReturn:function(){this.run=function(env){env.closeFrame();};this.getAsm=asmWithNoParam;},WsReadNum:function(){this.run=function(env){var num=env.readNum();var addr=env.stackPop();env.heap.store(addr,num);env.register.IP++;};this.getAsm=asmWithNoParam;},WsReadChar:function(){this.run=function(env){var ch=env.readChar();var addr=env.stackPop();env.heap.store(addr,ch.charCodeAt(0));env.register.IP++;};this.getAsm=asmWithNoParam;}};ws.keywords=[{ws:'  ',mnemo:'push',constr:ws.WsPush,param: "NUMBER"},{ws:' \n ',mnemo:'dup',constr:ws.WsDouble,param: null},{ws:' \t ',mnemo:'copy',constr:ws.WsCopyNth,param: "NUMBER"},{ws:' \n\t',mnemo:'swap',constr:ws.WsSwapTop,param: null},{ws:' \n\n',mnemo:'drop',constr:ws.WsDropTop,param: null},{ws:' \t\n',mnemo:'slide',constr:ws.WsSlide,param: "NUMBER"},{ws:'\t   ',mnemo:'add',constr:ws.WsAddition,param:null},{ws:'\t  \t',mnemo:'sub',constr:ws.WsSubtraction,param:null},{ws:'\t  \n',mnemo:'mul',constr:ws.WsMultiplication,param:null},{ws:'\t \t ',mnemo:'div',constr:ws.WsIntDivision,param:null},{ws:'\t \t\t',mnemo:'mod',constr:ws.WsModulo,param:null},{ws:'\t\t ',mnemo:'store',constr:ws.WsHeapStore,param:null},{ws:'\t\t\t',mnemo:'retrieve',constr:ws.WsHeapRetrieve,param:null},{ws:'\n  ',mnemo:'label',constr:ws.WsLabel,param:"LABEL"},{ws:'\n \t',mnemo:'call',constr:ws.WsCall,param:"LABEL"},{ws:'\n \n',mnemo:'jmp',constr:ws.WsJump,param:"LABEL"},{ws:'\n\t ',mnemo:'jz',constr:ws.WsJumpZ,param:"LABEL"},{ws:'\n\t\t',mnemo:'jn',constr:ws.WsJumpNeg,param:"LABEL"},{ws:'\n\t\n',mnemo:'ret',constr:ws.WsReturn,param:null},{ws:'\n\n\n',mnemo:'end',constr:ws.WsEndProgram,param:null},{ws:'\t\n  ',mnemo:'printc',constr:ws.WsPrintChar,param:null},{ws:'\t\n \t',mnemo:'printi',constr:ws.WsPrintNum,param:null},{ws:'\t\n\t ',mnemo:'readc',constr:ws.WsReadChar,param:null},{ws:'\t\n\t\t',mnemo:'readi',constr:ws.WsReadNum,param:null}];for(var i in ws.keywords){var keyword=ws.keywords[i];var constr=keyword.constr;constr.prototype.mnemoCode=keyword.mnemo;constr.prototype.paramType=keyword.param;}var InstParser=function(){this.instFn=null;this.cont=[];this.addInstruction=function(keySeqStr,instFn){var instP=this;var keySeq=keySeqStr.split('');for(k in keySeq){var key=keySeq[k];if(!(key in instP.cont)){instP.cont[key]=new InstParser();}instP=instP.cont[key];}instFn.prototype.wsToken=keySeqStr;instP.instFn=instFn;}};var instParser=new InstParser();for(var i in ws.keywords){var keyword=ws.keywords[i];var constr=keyword.constr;instParser.addInstruction(keyword.ws,constr);}})();
var ws_fs=function(metaFile){var isValidFileName=function(fileName){return true&&fileName.match(/^[a-zA-z0-9._() \/-]+$/);};var flush=function(files){var local={files:{}};for(var fileName in files){var file=files[fileName];if(!file.extFile){local.files[fileName]=file;}}localStorage.ws_fs=JSON.stringify(local);};var handleFiles=function(data,files,extFile){try{var json=JSON.parse(data);}catch(err){console.log("Unable to parse JSON: "+err);}for(fileName in json.files){if(isValidFileName(fileName)&&!(fileName in files)){var file=json.files[fileName];file.extFile=extFile;file.name=fileName;files[fileName]=file;}}};var loadFilesServer=function(files){$.ajax({url:metaFile,converters:{"text json":window.String},success:function(data){handleFiles(data,files,true);},error:function(jqXHR,textStatus,errorThrown){console.log("Unable to read '"+metaFile+"': "+textStatus);},async:false});};var loadFilesLocal=function(files){if(typeof localStorage=="undefined"){console.log("Local storage not supported!");return;}var data=localStorage.ws_fs||"{}";handleFiles(data,files,false);};var loadFiles=function(){var files={};loadFilesServer(files);loadFilesLocal(files);return files;};var self={files:loadFiles(),getFile:function(fileName){return self.files[fileName];},rename:function(oldName,newName){if(oldName==newName)return;if(!(oldName in self.files)||newName in self.files){console.log("Won't replace file!");return;}if(!isValidFileName(newName)){console.log("Not a valid file name: '"+newName+"'.");return;}delete self.fileNames;var file=self.files[oldName];file.name=newName;self.files[newName]=file;delete self.files[oldName];flush(self.files);},openFile:function(file){if(file.src||!file.extFile){return file.src;}else if(file.file){$.ajax({url:file.file,async:false,success:function(data){file.src = data;},error:function(){console.log("Unable to load file: '"+file.file+"'.");}});return file.src;}else{console.log("Unable to open file: '"+JSON.stringify(file));}},deleteFile:function(fileName){delete self.fileNames;delete self.files[fileName];flush(self.files);},getFileNames:function(){self.fileNames=[];for(fileName in self.files){self.fileNames.push(fileName);}self.fileNames.sort();return self.fileNames;},saveFile:function(file){self.files[file.name]=file;flush(self.files);}};return self;}("meta.json");
var ws_opt=(function(){LabelPlaceholder=function(labels){this.labels=labels;};var labelRef=function(labelMap,labels,ref){for(var l in labels){labelMap[labels[l]]=ref;}};var makePiece=function(stack,continues){return{reachable:false,continues:continues,continued:false,recursion:false,innerLoop:false,calledFrom:{},jumpedFrom:{},callsTo:{},jumpsTo:{},stack:stack};};var shredProgram=function(prog){var labelMap={"$":0};var pieces=[];var currentStack=[];var ignorePieceEnd=false;for(var pp in prog.programStack){var inst=prog.programStack[pp];if(inst.labels){if(currentStack.length>0){pieces.push(makePiece(currentStack,!ignorePieceEnd));currentStack=[];ignorePieceEnd=false;}labelRef(labelMap,inst.labels,pieces.length);}if(!ignorePieceEnd){currentStack.push(inst);if(inst instanceof ws.WsJump||inst instanceof ws.WsEndProgram||inst instanceof ws.WsReturn){ignorePieceEnd=true;}}}pieces.push(makePiece(currentStack,!ignorePieceEnd));return{builder:prog,labelMap:labelMap,pieces:pieces};};var analyzePieces=function(shred){for(var pieceNr in shred.pieces){pieceNr=parseInt(pieceNr);var piece=shred.pieces[pieceNr];for(var ip in piece.stack){var inst=piece.stack[ip];if(inst instanceof ws.WsJump||inst instanceof ws.WsJumpZ||inst instanceof ws.WsJumpNeg||inst instanceof ws.WsCall){var target=shred.labelMap[inst.param.token];if(typeof target=="undefined"){throw"Undefined target in piece "+pieceNr;}if(target!=pieceNr){if(inst instanceof ws.WsCall){shred.pieces[target].calledFrom[pieceNr]=(shred.pieces[target].calledFrom[pieceNr]||0)+1;piece.callsTo[target]=true;}else{shred.pieces[target].jumpedFrom[pieceNr]=(shred.pieces[target].jumpedFrom[pieceNr]||0)+1;piece.jumpsTo[target]=true;}}else{if(inst instanceof ws.WsCall){piece.recursion=true;}else{piece.innerLoop=true;}}}}if(!pieceNr){piece.continued=true;}if(piece.continues&&(pieceNr+1) in shred.pieces){shred.pieces[pieceNr+1].continued=true;piece.jumpsTo[pieceNr+1]=(piece.jumpsTo[pieceNr+1]||0)+1;shred.pieces[pieceNr+1].jumpedFrom[pieceNr]=(shred.pieces[pieceNr+1].jumpedFrom[pieceNr]||0)+1;}}shred.pieces[shred.pieces.length-1].continues=false;return shred;};var filterPieces=function(shred){var reachables=[0];while(reachables.length>0){var pieceNr=parseInt(reachables.shift());var piece=shred.pieces[pieceNr];if(piece.reachable)continue;piece.reachable=true;if(piece.continues){reachables.push(pieceNr+1);}var targets=Object.keys(piece.callsTo).concat(Object.keys(piece.jumpsTo));for(var t in targets){reachables.push(targets[t]);}}};var growPiece=function(masterNr,shred){var masterPiece=shred.pieces[masterNr];if(!masterPiece.reachable)return;if(masterPiece.grown)return;masterPiece.grown=true;for(var subNr=masterNr+1;subNr<shred.pieces.length;subNr++){var subPiece=shred.pieces[subNr];if(!subPiece.reachable)continue;growPiece(subNr,shred);if(masterNr in subPiece.jumpedFrom&&Object.keys(subPiece.jumpedFrom).length==1&&(Object.keys(subPiece.calledFrom).length==0||Object.keys(subPiece.calledFrom).length==1&&masterNr in subPiece.calledFrom)){if(subNr<masterNr&&subPiece.continued)break;masterPiece.stack=masterPiece.stack.concat(subPiece.stack);delete masterPiece.jumpsTo[subNr];subPiece.reachable=false;masterPiece.innerLoop=masterPiece.innerLoop||subPiece.innerLoop||masterNr in subPiece.jumpsTo;masterPiece.recursion=masterPiece.recursion||subPiece.recursion||masterNr in subPiece.callsTo;masterPiece.continues=subPiece.continues;for(var tmpNr=subNr-1;tmpNr>=0;tmpNr--){var tmpPiece=shred.pieces[tmpNr];tmpPiece.continues=false;if(tmpPiece.reachable)break;}for(var i in subPiece.jumpsTo){if(i!=masterNr){masterPiece.jumpsTo[i]=(masterPiece.jumpsTo[i]||0)+subPiece.jumpsTo[i];}}for(var i in subPiece.callsTo){if(i!=masterNr){masterPiece.callsTo[i]=(masterPiece.callsTo[i]||0)+subPiece.callsTo[i];}}for(var tmpNr=0;tmpNr<shred.pieces.length;tmpNr++){var tmpPiece=shred.pieces[tmpNr];if(subNr in tmpPiece.calledFrom){var count=tmpPiece.calledFrom[subNr];delete tmpPiece.calledFrom[subNr];tmpPiece.calledFrom[masterNr]=(tmpPiece.calledFrom[masterNr]||0)+count;}if(subNr in tmpPiece.jumpedFrom){var count=tmpPiece.jumpedFrom[subNr];delete tmpPiece.jumpedFrom[subNr];tmpPiece.jumpedFrom[masterNr]=(tmpPiece.jumpedFrom[masterNr]||0)+count;}}for(var i in shred.labelMap){if(shred.labelMap[i]==subNr){shred.labelMap[i]=masterNr;}}if(masterNr in masterPiece.calledFrom)delete masterPiece.calledFrom[masterNr];if(masterNr in masterPiece.jumpedFrom)delete masterPiece.jumpedFrom[masterNr];}}};var unifyPieces=function(shred){for(var pieceNr=0;pieceNr<shred.pieces.length;pieceNr++){growPiece(pieceNr,shred);}};var pushPiece=function(builder,piece){if(piece.done)return;if(!piece.reachable)return;for(var iNr in piece.stack){var inst=piece.stack[iNr];if(inst instanceof LabelPlaceholder){builder.pendingLabels=builder.pendingLabels.concat(inst.labels);continue;}if(builder.pendingLabels.length>0){inst.labels=inst.labels||[];inst.labels=inst.labels.concat(builder.pendingLabels);builder.pendingLabels=[];}builder.pushInstruction(piece.stack[iNr]);}};var reassemble=function(shred){var builder=ws.programBuilder();builder.pendingLabels=[];for(var pieceNr in shred.pieces){pieceNr=parseInt(pieceNr);var piece=shred.pieces[pieceNr];pushPiece(builder,piece);}if(builder.pendingLabels.length>0){var endInst=new ws.WsEndProgram();endInst.labels=builder.pendingLabels;builder.pushInstruction(endInst);}delete builder.pendingLabels;builder.postProcess();return builder;};var getTarget=function(inst,shred){return shred.pieces[shred.labelMap[inst.param.token]];};var inlinePiece=function(piece,shred){if(!piece.reachable)return;if(piece.processing)return;piece.processing=true;var newStack=[];for(iNr in piece.stack){var pushInst=true;var inst=piece.stack[iNr];if(inst instanceof ws.WsJump){var target=getTarget(inst,shred);if(!target.continued&&!target.continues&&Object.keys(target.jumpedFrom).length==1&&target.jumpedFrom[Object.keys(target.jumpedFrom).shift()]==1){inlinePiece(target,shred);newStack=newStack.concat(target.stack);target.reachable=false;pushInst=false;}}else if(inst instanceof ws.WsCall){var target=getTarget(inst,shred);if(!target.continued&&!target.continues&&Object.keys(target.jumpedFrom).length==0&&Object.keys(target.calledFrom).length==1&&target.calledFrom[Object.keys(target.calledFrom).shift()]==1&&!target.recursion){inlinePiece(target,shred);var retLabel=null;for(var i in target.stack){var targetInst=target.stack[i];if(!(targetInst instanceof ws.WsReturn)){newStack.push(targetInst);}else if((targetInst.labels||[]).length>0){newStack.push(new LabelPlaceholder(targetInst.labels));}else if(parseInt(i)+1!=target.stack.length){if(!retLabel){var tmp=0;while(true){retLabel=ws_util.getWsUnsignedNumber(tmp++);if(!(retLabel in shred.builder.labels)){shred.builder.labels[retLabel]=-1;break;}}}var jmpInst=new ws.WsJump();jmpInst.param={token:retLabel};newStack.push(jmpInst);}}if(retLabel){newStack.push(new LabelPlaceholder(retLabel));}target.reachable=false;pushInst=false;}}if(pushInst){newStack.push(inst);}}piece.stack=newStack;piece.processing=false;};var inlineShred=function(shred){for(var pieceNr in shred.pieces){var piece=shred.pieces[pieceNr];inlinePiece(piece,shred);}};var reduceLabels=function(prog){var refCount={};for(var iNr in prog.programStack){var inst=prog.programStack[iNr];if(inst instanceof ws.WsCall||inst instanceof ws.WsJump||inst instanceof ws.WsJumpZ||inst instanceof ws.WsJumpNeg){var ref=prog.labels[inst.param.token];refCount[ref]=(refCount[ref]||0)+1}}var orderRef=[];for(var iNr in refCount){orderRef.push({iNr:iNr,count:refCount[iNr]});}orderRef=orderRef.sort(function(a,b){return b.count-a.count;});var refLabel={};for(var i in orderRef){refLabel[orderRef[i].iNr]=ws_util.getWsUnsignedNumber(i);}for(var iNr in prog.programStack){var inst=prog.programStack[iNr];inst.labels=[];if(iNr in refLabel){inst.labels.push(refLabel[iNr]);}if(inst instanceof ws.WsCall||inst instanceof ws.WsJump||inst instanceof ws.WsJumpZ||inst instanceof ws.WsJumpNeg){inst.param.token=refLabel[prog.labels[inst.param.token]];}}prog.labels={};for(var i in refLabel){prog.labels[refLabel[i]]=i;}};var self={_shred:function(prog){return shredProgram(prog);},_analyze:function(prog){return analyzePieces(shredProgram(prog));},optimize:function(prog){var shrd=shredProgram(prog);analyzePieces(shrd);filterPieces(shrd);unifyPieces(shrd);inlineShred(shrd);var optProg=reassemble(shrd);reduceLabels(optProg);return optProg;}};return self;})();
var ws_util=(function(){return{getWsUnsignedNumber:function(num){var result="";while(num){result=((num%2)?'\t':' ')+result;num=Math.floor(num / 2);}return result+'\n';},getWsSignedNumber:function(num){return((num>=0)?' ':'\t')+this.getWsUnsignedNumber(Math.abs(num));},labelTransformer:function(labelGenerator){var length=0;return{length:length,labels:{},getLabel:function(label){if(typeof label!="undefined"&&label in this.labels){return this.labels[label];}else{var gen=labelGenerator(length++,label);this.labels[label]=gen;return gen;}}};},getFilename:function(path){return path.replace(/^(?:.*[\/\\])?((?:[^\/\\])*)$/,'$1');},handleOverflow:function(selector){var selector$=$(selector);if(selector$[0].scrollHeight>selector$.height()){selector$.css('overflow-y','scroll');}else{selector$.css('overflow-y','hidden');}},StrArr:function(str){return{arr:str.split(''),pos:0,line:1,col:1,hasNext:function(){return this.pos<this.arr.length;},getNext:function(){var next=this.arr[this.pos++];if(next=='\n'){this.line++;this.col=1;}else{this.col++;}return next;},peek:function(){return this.arr[this.pos];}}}};})();
var logger=(function(){var writeTab=function(msg,level){var consoleArea=$('#consoleArea');consoleArea.append('<div>'+(level?level+': ':'')+msg+'<div>');consoleArea.scrollTop(consoleArea[0].scrollHeight);ws_util.handleOverflow(consoleArea);var tabLabel=$('#tabLabelConsole');if(!tabLabel.is('.activeTab')){tabLabel.addClass('emph');}};return{log:writeTab,info:function(msg){writeTab(msg,"INFO");},error:function(msg){writeTab(msg,"ERROR");},warn:function(msg){writeTab(msg,"WARNING");}};})();
var ws_ide=(function(){var updateOverlay=function(){var srcInput=$('#srcInput');var srcOverlay=$('#srcOverlay');var src=srcInput.val();var overlay='';if(ws_ide.highlightEnabled&&ws_ide.openFile){overlay=ws_ide.highlightSourceWs(src);}srcOverlay.html(overlay);var pre=$('#srcHiddenDiv');pre.text(src);srcInput.width(pre.width()+30);srcInput.height(pre.height()+30);$('#inputContainer').height(srcInput.height());};var compileProgram=function(){var disasm=$('#disasm');disasm.html('');var openFile=ws_ide.openFile;var src=programSource();var errorDiv=$('#errorDiv');errorDiv.html('&nbsp;');try{if(openFile.lang=="WS"){ws_ide.program=ws.compile(src);}else{ws_ide.program=ws_asm.compile(src);}delete ws_ide.program.compileError;}catch(err){if(ws_ide.program){ws_ide.program.compileError="Unknown compile error";}if(err.program){errorDiv.text(err.message);ws_ide.program=err.program;ws_ide.program.compileError=err.message;}else{throw err;}};var disasmSrc=ws_ide.program.getAsmSrc();for(var i in disasmSrc){var ln=disasmSrc[i];var div=$('<div class="asmLine"></div>');div.text(ln.str);if(ln.IP!=null){div.addClass('asmInstr');div.attr('id','instr_'+ln.IP);if(ws_ide.openFile.breakpoints&&ln.IP in ws_ide.openFile.breakpoints){div.addClass('breakpoint');}div.click((function(ip){return function(){ws_ide.toggleBreakpoint(ip);}})(ln.IP));}else{div.addClass('asmLabel');}div.appendTo(disasm);}ws_ide.openFile.breakpoints=ws_ide.openFile.breakpoints||{};ws_util.handleOverflow(disasm.parent());};var updateEditor=function(evt){updateOverlay();ws_util.handleOverflow("#scrollableSource");compileProgram();};var programSource=function(src){var srcInput=$('#srcInput');if(typeof src=="undefined"){return srcInput.val();}else{var ret=ws_ide.loadSource(src);updateEditor();return ret;}};var resizeUserInput=function(){var input=$('#userInput');var form=input.closest('form');var container=form.parent();input.width(0);input.width(container.width()-(input.position().left-container.position().left));};var printOutput=function(str){if(typeof str!="string"){str=""+str;};var printArea=$('#printArea');var arr=str.split('\n');var last=printArea.find('span:last');for(var ln in arr){if(ln!=0){last.after('<br><span></span>');last=printArea.find('span:last');}last.html(last.html()+arr[ln]);}outputArea=printArea.closest('.outputArea');ws_util.handleOverflow(outputArea);outputArea.scrollTop(outputArea[0].scrollHeight);var tabLabel=$('#tabLabelPrint');if(!tabLabel.is('.activeTab')){tabLabel.addClass('emph');}resizeUserInput();};var readChar=function(){if(ws_ide.inputStreamPtr<ws_ide.inputStream.length){return ws_ide.inputStream[ws_ide.inputStreamPtr++];}else{ws_ide.focusUserInput('#userInput');throw"IOWait";}};var readNum=function(){var numStr="";while(true){var ch=readChar();if(ch=='\n')break;numStr+=ch;};var num=parseInt(numStr);if(typeof num=="NaN"){throw"Illegal number entered!";}return num;};var updateMemoryTab=function(env){$('#stackSpan').html('['+env.stack.slice(0,env.register.SP).join(', ')+']');var heapArr=[];var heap=env.heap.toArray();for(i in heap){heapArr.push(i+':'+heap[i]);}$('#heapSpan').html('{\t'+heapArr.join(',\t')+'}');};var afterInstructionRun=function(env){env.runCount++;if(env.runCount>100){throw"SLEEP";}if(env.debug){updateMemoryTab(env);}};var stupidHash=function(str){return btoa(str).replace(/[^a-zA-Z0-9]/g,'_');};var updateFileList=function(){var fileList=$('#fileList');fileList.find('.fileEntry').remove();var sortedFileNames=ws_fs.getFileNames();var id=0;for(var i in sortedFileNames){++id;var fileName=sortedFileNames[i];var file=ws_fs.getFile(fileName);var line=$('<div id="file_'+id+'" title="'+fileName+'"></div>');line.addClass('fileEntry');if(file.lang=="WSA"){line.addClass('fileTypeAsm');}else{line.addClass('fileTypeWs');}if(!file.localStorage){var link=$('<a href="javascript: void(0);" onClick="ws_ide.loadFile(\''+fileName+'\');"></a>');link.html('<div class="ico"></div>'+$('<span></span>').text(fileName).html());link.appendTo(line);}else{var link=$('<div><div class="ico"></div></div>');link.click((function(fileName){return function(){ws_ide.loadFile(fileName);$(this).find('input').focus().select();}})(fileName));var form=$('<form onsubmit="return false;"></form>');var inp=$('<input type="text" class="userInput"></input>');var nameChange=(function(fileName,id){return function(){ws_ide.handleFileRename(fileName,id);};})(fileName,id);inp.blur(nameChange);inp.change(nameChange);inp.val(file.name);inp.appendTo(form);form.appendTo(link);link.appendTo(line);}line.appendTo(fileList);}ws_util.handleOverflow(fileList.closest('.content'));};var storeSource=function(){var file=ws_ide.openFile;if(!file)return;file.src=programSource();};var showLang=function(lang){$('#filetype .btn').hide();$('#filetype #lang_'+lang).show();if(lang=="WS"){$('#btnOptimize').show();}else{$('#btnOptimize').hide();}if(lang=="WSA"){$('#btnCompile').show();}else{$('#btnCompile').hide();}};var beforeInstructionRun=function(env){if(!env.debug||!env.running)return;$('#disasm .running').removeClass('running');var instLine=$('#disasm #instr_'+env.register.IP);var scroller=instLine.closest(".content");if((instLine.offset().top+instLine.height())>scroller.offset().top+scroller.height()||instLine.offset().top<scroller.offset().top){scroller.animate({scrollTop:(scroller.scrollTop()+instLine.offset().top-scroller.height()/2)+"px"},0);}instLine.addClass('running');if(env.continueDebug){env.continueDebug=false;}else if(env.stepProgram){env.stepProgram=false;throw"Break";}else if(env.debug&&env.register.IP in ws_ide.openFile.breakpoints){throw"Break";}};var cleanupDebug=function(){$('.asmline.running').removeClass('running');};var createNewFile=function(fileName){if(!fileName){fileName='New file ';var count=1;while(true){if(!((fileName+count)in ws_fs.files)){fileName=fileName+count;break;}count++;}};var file={name:fileName,file:"<localStorage>",autohor:"",origin:"",src:"",lang:"WS",localStorage:true};ws_fs.saveFile(file);return fileName;};var getProgramStat=function(src){var size=src.length;var prog=ws.compile(src);var instCount=prog.programStack.length;return{size:size,instCount:instCount};};var self={files:{},inputStream:'',inputStreamPtr:0,animator:0,animation:['.oO0 ',' .oO0','  .o0','   .0','    0','   0O','  00o',' 0Oo.','0Oo. ','0o.  ','0.   ','0    ','O0   ','oO0  ',],defaultFile:[],highlightSourceWs:function(src){return src.replace(/[^\t\n ]/g,'#').replace(/([ ]+)/g,'<span class="spaces">\$1</span>').replace(/(\t+)/g,'<span class="tabs">\$1</span>').replace(/#/g,' ');},init:function(){$('#srcInput').keyup(updateEditor);$('#srcInput').keydown(function(e){var ret=interceptTabs(e,this);return ret;});ws_ide.loadFile("hworld.ws");updateFileList();ws_ide.initEnv();ws_ide.switchTab('a[href=#printTab]');},initEnv:function (){var env=ws.env();env.print=printOutput;env.readChar=readChar;env.readNum=readNum;env.afterInstructionRun=afterInstructionRun;env.beforeInstructionRun=beforeInstructionRun;ws_ide.env=env;return env;},loadSource:function(src){var ret=$('#srcInput').val(src);updateEditor();return ret;},loadFile:function(fileName){storeSource();$('#fileList .fileEntry.emph').removeClass('emph');var file=ws_fs.getFile(fileName);if(!file)return;if(ws_ide.openFile){if(ws_ide.defaultFile[ws_ide.defaultFile.length-1]!=ws_ide.openFile.name){ws_ide.defaultFile.push(ws_ide.openFile.name);}}if(file.lang=='WS'||file.file.match(/\.ws$/i)){this.setHighlight(true);}else{this.setHighlight(false);}ws_ide.openFile=file;ws_ide.loadSource(ws_fs.openFile(file));updateEditor();$('#panelMiddleLabel span').text(file.file);$('.localStorageButton').hide();if(file.localStorage){$('.localStorageButton').show();}showLang(file.lang||'WS');ws_ide.initEnv();},runProgram:function(debugMode,stepMode){ws_ide.animateRunning(true);try{if(!debugMode||!ws_ide.env.running){ws_ide.inputStream='';ws_ide.inputStreamPtr=0;compileProgram();if(!debugMode||!ws_ide.env.running){ws_ide.initEnv();}ws_ide.env.debug=debugMode||false;ws_ide.env.running=true;}else if(debugMode){ws_ide.env.continueDebug=true;}ws_ide.env.stepProgram=stepMode||false;ws_ide.continueRun();}catch(err){if(!err.program){logger.error("Compile Error: "+err);}}},continueRun:function(){if(!ws_ide.env.running)return;ws_ide.env.runCount=0;try{ws_ide.env.runProgram(ws_ide.program);if(!ws_ide.env.running){cleanupDebug();ws_ide.stopAnimateRunning();}}catch(err){if(err=="SLEEP"){setTimeout(ws_ide.continueRun,1);}else if(err=="IOWait"){}else if(err!="Break"){logger.error("Runtime Error: "+err);ws_ide.env.running=false;ws_ide.stopAnimateRunning();}}updateMemoryTab(ws_ide.env);},stepProgram:function(){if(!ws_ide.env.running){ws_ide.runProgram(true,true);}else{ws_ide.env.stepProgram=true;ws_ide.env.continueDebug=true;ws_ide.continueRun();}},optimizeProgram:function(){var src=programSource();var currentStat=getProgramStat(src);var prog=ws.compile(src);var src=ws_opt.optimize(prog).getWsSrc();var optStat=getProgramStat(src);logger.log("Optimized "+ws_ide.openFile.name+":\n"+"  Size:         "+currentStat.size+" bytes -> "+optStat.size+" bytes ("+Math.round((currentStat.size-optStat.size)/(currentStat.size||1)*100)+"%)\n"+"  Instructions: "+currentStat.instCount+" -> "+optStat.instCount+" ("+Math.round((currentStat.instCount-optStat.instCount)/(currentStat.instCount||1)*100)+"%)");programSource(src);},switchTab:function(selector){var link=$(selector);var tabSelector=$(link).attr("href");var tab=$(tabSelector);link.closest(".outputTabs").find(".btn").removeClass("activeTab");link.closest(".btn").addClass("activeTab").removeClass("emph");tab.closest(".allTabs").find(".tabContent:visible").not(tabSelector).hide();tab.show();resizeUserInput();return false;},handleUserInput:function(selector){var input=$(selector);var val=input.val()+'\n';ws_ide.inputStream+=val;printOutput(val);input.val('');this.continueRun();return false;},focusUserInput:function(selector){var input=$(selector);input.focus();},clearPrintArea:function(selector){var area=$(selector);if(area.find('span').length>0){area.find('span:not(:last)').remove();area.find('span').html('');ws_util.handleOverflow(area.parent());}else{area.html('');ws_util.handleOverflow(area);}},setHighlight:function(enable){if(ws_ide.highlightEnabled===enable){return;}ws_ide.highlightEnabled=enable;if(enable){$('#btnDisableHighlight').show();$('#btnEnableHighlight').hide();}else{$('#btnDisableHighlight').hide();$('#btnEnableHighlight').show();}updateOverlay();},newFile:function(){var fileName=createNewFile();updateFileList();ws_ide.loadFile(fileName);},deleteFile:function(){var fileName=ws_ide.openFile.name;if(!ws_fs.files[fileName]||!ws_fs.files[fileName].localStorage){return;}ws_fs.deleteFile(fileName);updateFileList();while(true){if(!ws_ide.defaultFile.length)break;fileName=ws_ide.defaultFile[ws_ide.defaultFile.length-1];if(ws_fs.files[fileName]){ws_ide.loadFile(fileName);break;}else{ws_ide.defaultFile.pop();}}},saveFile:function(){storeSource();var file=ws_ide.openFile;if(!file||!file.localStorage)return;if(typeof localStorage=="undefined")return;ws_fs.saveFile(file);},handleFileRename:function(fileName,id){var input$=$('#file_'+id+' input');ws_fs.rename(fileName,input$.val());updateFileList();},setLang:function(lang){ws_ide.openFile.lang =lang;showLang(lang);updateFileList();compileProgram();},toggleBreakpoint:function(ip){var instrDiv=$('#instr_'+ip);if(ip in ws_ide.openFile.breakpoints){delete ws_ide.openFile.breakpoints[ip];instrDiv.removeClass('breakpoint');}else{ws_ide.openFile.breakpoints[ip]=true;instrDiv.addClass('breakpoint');}},compileAsm:function(){if(ws_ide.program.compileError){logger.error(ws_ide.program.compileError);return;};var fileName="compile.ws";if(!(fileName in ws_fs.files)){createNewFile(fileName);}var file=ws_fs.getFile(fileName);var wsSrc=ws_ide.program.getWsSrc();file.src=wsSrc;updateFileList();ws_ide.loadFile(fileName);},downloadFile:function(){window.open('data:text/plain;base64,'+btoa(ws_ide.openFile.src),'_download');},stopProgram:function(){if(!ws_ide.env.running){return;}ws_ide.env.running=false;cleanupDebug();ws_ide.stopAnimateRunning();},animateRunning:function(resume){var ad=$('#animDiv');if(ws_ide.animator<0&&resume){ws_ide.animator=0;}else if(ws_ide.animator<0){ad.html('&nbsp;');return;}ad.text(ws_ide.animation[ws_ide.animator]);ws_ide.animator=(ws_ide.animator+1)%ws_ide.animation.length;setTimeout(ws_ide.animateRunning,150);},stopAnimateRunning:function(){ws_ide.animator=-1;},};$(self.init);return self;})();