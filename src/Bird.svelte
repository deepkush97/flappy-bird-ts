<script lang="ts" >
  import type {Bird} from './game';
  export let bird:Bird;
</script>

<style>
  #bird{
    border: solid black 1px;
    background-color: yellow;
    position: absolute;
  }
</style>

<section
style="height:{bird.size}px; width:{bird.size}px; left:{bird.left}px; top:{bird.top}px;"
id="bird"
>

</section>