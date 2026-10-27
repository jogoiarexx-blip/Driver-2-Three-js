/**
 * Carregador por unidades reais de trabalho. A barra só avança quando uma
 * operação termina, ou quando a operação informa partes concluídas.
 */
class DriverLoadScheduler {
    static async execute(tasks, onUpdate=()=>{}, beforeTask=()=>Promise.resolve()) {
        const total=tasks.reduce((n,t)=>n+Math.max(0,t.weight||0),0);
        if(total<=0)throw new Error('Carregamento sem tarefas');
        let done=0;
        const publish=(weight,ratio,label)=>{
            const value=(done+Math.max(0,weight)*Math.max(0,Math.min(1,Number(ratio)||0)))/total;
            onUpdate({fraction:Math.max(0,Math.min(1,value)),label});
        };
        for(const task of tasks){
            const weight=Math.max(0,task.weight||0);
            publish(weight,0,task.label);
            await beforeTask();
            await task.run((ratio,detail)=>publish(weight,ratio,detail||task.label));
            done+=weight;
            onUpdate({fraction:Math.min(1,done/total),label:task.label+' • concluído'});
            await beforeTask();
        }
        return true;
    }
}
